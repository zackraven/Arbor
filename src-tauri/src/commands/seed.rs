use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

#[cfg(feature = "app")]
use tauri::State;

#[cfg(feature = "app")]
use crate::DbConn;

use crate::errors::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Scope {
    pub top_bubble: String,
    pub categories: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SeedNode {
    pub id: String,
    pub title: String,
    pub one_liner: String,
    pub category: String,
    pub outcomes: Vec<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SeedEdge {
    pub parent_id: String,
    pub child_id: String,
    pub justification: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SeedTree {
    pub id: String,
    pub title: String,
    pub scope: Scope,
    pub nodes: Vec<SeedNode>,
    pub edges: Vec<SeedEdge>,
}

/// Return current UTC time as an ISO 8601 string.
fn now_utc() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let (y, mo, d, h, mi, s) = secs_to_datetime(secs);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

fn secs_to_datetime(secs: u64) -> (u64, u64, u64, u64, u64, u64) {
    let s = secs % 60;
    let total_min = secs / 60;
    let mi = total_min % 60;
    let total_h = total_min / 60;
    let h = total_h % 24;
    let total_days = total_h / 24;
    let (y, mo, d) = days_to_ymd(total_days);
    (y, mo, d, h, mi, s)
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut year = 1970u64;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let month_days: [u64; 12] = [
        31,
        if is_leap(year) { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut month = 1u64;
    for md in &month_days {
        if days < *md {
            break;
        }
        days -= md;
        month += 1;
    }
    (year, month, days + 1)
}

fn is_leap(year: u64) -> bool {
    (year.is_multiple_of(4) && !year.is_multiple_of(100)) || year.is_multiple_of(400)
}

/// Kahn's algorithm topological sort — returns Err if a cycle exists.
fn check_acyclic(node_ids: &[String], edges: &[SeedEdge]) -> Result<(), AppError> {
    // Build in-degree map and adjacency list (parent → children)
    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    let mut adj: HashMap<&str, Vec<&str>> = HashMap::new();

    for id in node_ids {
        in_degree.entry(id.as_str()).or_insert(0);
        adj.entry(id.as_str()).or_default();
    }

    for edge in edges {
        *in_degree.entry(edge.child_id.as_str()).or_insert(0) += 1;
        adj.entry(edge.parent_id.as_str())
            .or_default()
            .push(edge.child_id.as_str());
    }

    let mut queue: VecDeque<&str> = in_degree
        .iter()
        .filter(|(_, &deg)| deg == 0)
        .map(|(&id, _)| id)
        .collect();

    let mut visited = 0usize;

    while let Some(node) = queue.pop_front() {
        visited += 1;
        if let Some(children) = adj.get(node) {
            for &child in children {
                let deg = in_degree.entry(child).or_insert(0);
                *deg -= 1;
                if *deg == 0 {
                    queue.push_back(child);
                }
            }
        }
    }

    if visited == node_ids.len() {
        Ok(())
    } else {
        Err(AppError::CycleDetected(
            "cycle detected in edge set".to_string(),
        ))
    }
}

pub fn seed_graph_impl(conn: &Connection, seed: SeedTree) -> Result<(), AppError> {
    // --- Validation ---

    // Check for duplicate node ids
    let mut seen_ids: HashSet<&str> = HashSet::new();
    for node in &seed.nodes {
        if !seen_ids.insert(node.id.as_str()) {
            return Err(AppError::DuplicateNode(format!(
                "duplicate node id '{}'",
                node.id
            )));
        }
    }

    // Check for self-loops
    for edge in &seed.edges {
        if edge.parent_id == edge.child_id {
            return Err(AppError::SelfLoop(format!(
                "self-loop on node '{}'",
                edge.parent_id
            )));
        }
    }

    // Check that all edge endpoints exist in the node list
    for edge in &seed.edges {
        if !seen_ids.contains(edge.parent_id.as_str()) {
            return Err(AppError::DanglingEdge(format!(
                "edge parent '{}' not in node list",
                edge.parent_id
            )));
        }
        if !seen_ids.contains(edge.child_id.as_str()) {
            return Err(AppError::DanglingEdge(format!(
                "edge child '{}' not in node list",
                edge.child_id
            )));
        }
    }

    // Cycle detection
    let node_ids: Vec<String> = seed.nodes.iter().map(|n| n.id.clone()).collect();
    check_acyclic(&node_ids, &seed.edges)?;

    // --- Insertion (single transaction) ---
    conn.execute_batch("BEGIN;")
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let result = (|| -> Result<(), AppError> {
        let now = now_utc();

        // Serialise scope
        let scope_json = serde_json::to_string(&seed.scope)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // Insert tree row with version = 1
        conn.execute(
            "INSERT INTO tree (id, title, scope_json, version, created_at, updated_at) \
             VALUES (?1, ?2, ?3, 1, ?4, ?5)",
            rusqlite::params![seed.id, seed.title, scope_json, now, now],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        // Insert node rows
        for node in &seed.nodes {
            let status = node
                .status
                .as_deref()
                .unwrap_or("not_started");
            let outcomes_json = serde_json::to_string(&node.outcomes)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            conn.execute(
                "INSERT INTO node (id, tree_id, title, one_liner, category, outcomes_json, \
                 status, pack_path, provenance_json, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, '{}', ?8, ?9)",
                rusqlite::params![
                    node.id,
                    seed.id,
                    node.title,
                    node.one_liner,
                    node.category,
                    outcomes_json,
                    status,
                    now,
                    now
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        // Insert edge rows
        for edge in &seed.edges {
            conn.execute(
                "INSERT INTO edge (tree_id, parent_id, child_id, justification, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![seed.id, edge.parent_id, edge.child_id, edge.justification, now],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        // Write graph_log entries: one node_added per node
        for node in &seed.nodes {
            let payload = serde_json::json!({ "node_id": node.id });
            let payload_json = serde_json::to_string(&payload)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            conn.execute(
                "INSERT INTO graph_log (tree_id, tree_version, change_type, entity_id, \
                 payload_json, actor, created_at) VALUES (?1, 1, 'node_added', ?2, ?3, \
                 'build_pipeline', ?4)",
                rusqlite::params![seed.id, node.id, payload_json, now],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        // Write graph_log entries: one edge_added per edge
        for edge in &seed.edges {
            let entity_id = format!("{}->{}", edge.parent_id, edge.child_id);
            let payload = serde_json::json!({
                "parent_id": edge.parent_id,
                "child_id": edge.child_id
            });
            let payload_json = serde_json::to_string(&payload)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            conn.execute(
                "INSERT INTO graph_log (tree_id, tree_version, change_type, entity_id, \
                 payload_json, actor, created_at) VALUES (?1, 1, 'edge_added', ?2, ?3, \
                 'build_pipeline', ?4)",
                rusqlite::params![seed.id, entity_id, payload_json, now],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")
                .map_err(|e| AppError::Internal(e.to_string()))?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK;");
            Err(e)
        }
    }
}

pub fn update_node_status_impl(
    conn: &Connection,
    node_id: &str,
    status: &str,
) -> Result<(), AppError> {
    // Validate status
    if !matches!(status, "not_started" | "in_progress" | "completed") {
        return Err(AppError::InvalidStatusTransition(format!(
            "'{status}' is not a valid status"
        )));
    }

    conn.execute_batch("BEGIN;")
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let result = (|| -> Result<(), AppError> {
        // Fetch the node (and its tree_id + current status)
        let node_result = conn.query_row(
            "SELECT tree_id, status FROM node WHERE id = ?1",
            [node_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        );

        let (tree_id, old_status) = match node_result {
            Ok(v) => v,
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                return Err(AppError::NotFound(format!("node '{node_id}' not found")));
            }
            Err(e) => return Err(AppError::Internal(e.to_string())),
        };

        let now = now_utc();

        // Update node status and updated_at
        conn.execute(
            "UPDATE node SET status = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![status, now, node_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        // Bump tree version
        conn.execute(
            "UPDATE tree SET version = version + 1, updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, tree_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        // Get new tree version
        let new_version: i64 = conn
            .query_row(
                "SELECT version FROM tree WHERE id = ?1",
                [&tree_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // Write graph_log entry
        let payload = serde_json::json!({
            "old_status": old_status,
            "new_status": status
        });
        let payload_json =
            serde_json::to_string(&payload).map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "INSERT INTO graph_log (tree_id, tree_version, change_type, entity_id, \
             payload_json, actor, created_at) VALUES (?1, ?2, 'node_updated', ?3, ?4, \
             'user', ?5)",
            rusqlite::params![tree_id, new_version, node_id, payload_json, now],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")
                .map_err(|e| AppError::Internal(e.to_string()))?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK;");
            Err(e)
        }
    }
}

#[cfg(feature = "app")]
#[tauri::command]
pub fn seed_graph(db: State<DbConn>, tree: SeedTree) -> Result<(), AppError> {
    let conn = db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    seed_graph_impl(&conn, tree)
}

#[cfg(feature = "app")]
#[tauri::command]
pub fn update_node_status(
    db: State<DbConn>,
    node_id: String,
    status: String,
) -> Result<(), AppError> {
    let conn = db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    update_node_status_impl(&conn, &node_id, &status)
}
