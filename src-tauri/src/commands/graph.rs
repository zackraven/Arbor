use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;

#[cfg(feature = "app")]
use tauri::State;

#[cfg(feature = "app")]
use crate::DbConn;

use crate::errors::AppError;

#[derive(Debug, Serialize)]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub one_liner: String,
    pub category: String,
    pub status: String,
    pub pack_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GraphEdge {
    pub id: i64,
    pub parent_id: String,
    pub child_id: String,
    pub justification: String,
}

#[derive(Debug, Serialize)]
pub struct Graph {
    pub tree_id: String,
    pub tree_version: i64,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize)]
pub struct NodeDetail {
    pub id: String,
    pub tree_id: String,
    pub title: String,
    pub one_liner: String,
    pub category: String,
    pub outcomes: Vec<String>,
    pub status: String,
    pub pack_path: Option<String>,
    pub provenance: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct GraphLogEntry {
    pub id: i64,
    pub tree_version: i64,
    pub change_type: String,
    pub entity_id: String,
    pub payload: Value,
    pub actor: String,
    pub created_at: String,
}

pub fn get_graph_impl(conn: &Connection, tree_id: &str) -> Result<Graph, AppError> {
    // Verify tree exists and get version
    let tree_result = conn.query_row(
        "SELECT version FROM tree WHERE id = ?1",
        [tree_id],
        |row| row.get::<_, i64>(0),
    );

    let tree_version = match tree_result {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(AppError::NotFound(format!("tree '{tree_id}' not found")));
        }
        Err(e) => return Err(AppError::Internal(e.to_string())),
    };

    // Query all nodes for this tree
    let mut stmt = conn
        .prepare(
            "SELECT id, title, one_liner, category, status, pack_path \
             FROM node WHERE tree_id = ?1",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let nodes = stmt
        .query_map([tree_id], |row| {
            Ok(GraphNode {
                id: row.get(0)?,
                title: row.get(1)?,
                one_liner: row.get(2)?,
                category: row.get(3)?,
                status: row.get(4)?,
                pack_path: row.get(5)?,
            })
        })
        .map_err(|e| AppError::Internal(e.to_string()))?
        .map(|r| r.map_err(|e| AppError::Internal(e.to_string())))
        .collect::<Result<Vec<_>, _>>()?;

    // Query all edges for this tree
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, child_id, justification \
             FROM edge WHERE tree_id = ?1",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let edges = stmt
        .query_map([tree_id], |row| {
            Ok(GraphEdge {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                child_id: row.get(2)?,
                justification: row.get(3)?,
            })
        })
        .map_err(|e| AppError::Internal(e.to_string()))?
        .map(|r| r.map_err(|e| AppError::Internal(e.to_string())))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Graph {
        tree_id: tree_id.to_string(),
        tree_version,
        nodes,
        edges,
    })
}

pub fn get_node_impl(conn: &Connection, node_id: &str) -> Result<NodeDetail, AppError> {
    let result = conn.query_row(
        "SELECT id, tree_id, title, one_liner, category, outcomes_json, status, pack_path, \
         provenance_json, created_at, updated_at FROM node WHERE id = ?1",
        [node_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, String>(10)?,
            ))
        },
    );

    match result {
        Ok((id, tree_id, title, one_liner, category, outcomes_json, status, pack_path, provenance_json, created_at, updated_at)) => {
            let outcomes: Vec<String> = serde_json::from_str(&outcomes_json)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let provenance: Value = serde_json::from_str(&provenance_json)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            Ok(NodeDetail {
                id,
                tree_id,
                title,
                one_liner,
                category,
                outcomes,
                status,
                pack_path,
                provenance,
                created_at,
                updated_at,
            })
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err(AppError::NotFound(format!("node '{node_id}' not found")))
        }
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}

pub fn get_graph_log_impl(
    conn: &Connection,
    tree_id: &str,
    limit: Option<u32>,
) -> Result<Vec<GraphLogEntry>, AppError> {
    // Verify tree exists
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tree WHERE id = ?1",
            [tree_id],
            |row| row.get(0),
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if exists == 0 {
        return Err(AppError::NotFound(format!("tree '{tree_id}' not found")));
    }

    // Use a large sentinel (i64::MAX) when no limit is requested so a single
    // prepared statement covers both code paths without borrow-lifetime issues.
    let effective_limit: i64 = limit.map(|l| l as i64).unwrap_or(i64::MAX);

    let mut stmt = conn
        .prepare(
            "SELECT id, tree_version, change_type, entity_id, payload_json, actor, created_at \
             FROM graph_log WHERE tree_id = ?1 ORDER BY id DESC LIMIT ?2",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let entries = stmt
        .query_map(rusqlite::params![tree_id, effective_limit], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| AppError::Internal(e.to_string()))?
        .map(|r| {
            r.map_err(|e| AppError::Internal(e.to_string())).and_then(
                |(id, tree_version, change_type, entity_id, payload_json, actor, created_at)| {
                    let payload: Value = serde_json::from_str(&payload_json)
                        .map_err(|e| AppError::Internal(e.to_string()))?;
                    Ok(GraphLogEntry {
                        id,
                        tree_version,
                        change_type,
                        entity_id,
                        payload,
                        actor,
                        created_at,
                    })
                },
            )
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(entries)
}

#[cfg(feature = "app")]
#[tauri::command]
pub fn get_graph(db: State<DbConn>, tree_id: String) -> Result<Graph, AppError> {
    let conn = db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    get_graph_impl(&conn, &tree_id)
}

#[cfg(feature = "app")]
#[tauri::command]
pub fn get_node(db: State<DbConn>, node_id: String) -> Result<NodeDetail, AppError> {
    let conn = db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    get_node_impl(&conn, &node_id)
}

#[cfg(feature = "app")]
#[tauri::command]
pub fn get_graph_log(
    db: State<DbConn>,
    tree_id: String,
    limit: Option<u32>,
) -> Result<Vec<GraphLogEntry>, AppError> {
    let conn = db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    get_graph_log_impl(&conn, &tree_id, limit)
}
