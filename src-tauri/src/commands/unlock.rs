use rusqlite::Connection;
use std::collections::HashMap;

#[cfg(feature = "app")]
use tauri::State;

#[cfg(feature = "app")]
use crate::DbConn;

use crate::errors::AppError;

pub fn compute_unlock_impl(
    conn: &Connection,
    tree_id: &str,
) -> Result<HashMap<String, String>, AppError> {
    // a. Verify tree exists; return NotFound if absent.
    let tree_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tree WHERE id = ?1",
            [tree_id],
            |row| row.get(0),
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if tree_exists == 0 {
        return Err(AppError::NotFound(format!("tree '{tree_id}' not found")));
    }

    // b. Query all nodes for the tree: SELECT id, status FROM node WHERE tree_id = ?
    let mut stmt = conn
        .prepare("SELECT id, status FROM node WHERE tree_id = ?1")
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let node_statuses: HashMap<String, String> = stmt
        .query_map([tree_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| AppError::Internal(e.to_string()))?
        .map(|r| r.map_err(|e| AppError::Internal(e.to_string())))
        .collect::<Result<HashMap<_, _>, _>>()?;

    // c. Query all edges for the tree: SELECT parent_id, child_id FROM edge WHERE tree_id = ?
    let mut stmt = conn
        .prepare("SELECT parent_id, child_id FROM edge WHERE tree_id = ?1")
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let edge_rows: Vec<(String, String)> = stmt
        .query_map([tree_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| AppError::Internal(e.to_string()))?
        .map(|r| r.map_err(|e| AppError::Internal(e.to_string())))
        .collect::<Result<Vec<_>, _>>()?;

    // d. Build a map of node_id → Vec<child_id> from edges.
    let mut children: HashMap<String, Vec<String>> = HashMap::new();
    // Ensure every node has an entry (even nodes with no children).
    for node_id in node_statuses.keys() {
        children.entry(node_id.clone()).or_default();
    }
    for (parent_id, child_id) in edge_rows {
        children.entry(parent_id).or_default().push(child_id);
    }

    // e. For each node, compute UnlockStatus.
    let mut result: HashMap<String, String> = HashMap::new();
    for (node_id, status) in &node_statuses {
        let unlock_status = match status.as_str() {
            "completed" => "completed".to_string(),
            "in_progress" => "in_progress".to_string(),
            "not_started" => {
                let node_children = children.get(node_id).map(|v| v.as_slice()).unwrap_or(&[]);
                if node_children.is_empty() {
                    // Leaf node with not_started → unlocked
                    "unlocked".to_string()
                } else {
                    // All children completed → unlocked; otherwise → locked
                    let all_completed = node_children.iter().all(|child_id| {
                        node_statuses.get(child_id).map(|s| s.as_str()) == Some("completed")
                    });
                    if all_completed {
                        "unlocked".to_string()
                    } else {
                        "locked".to_string()
                    }
                }
            }
            other => {
                return Err(AppError::Internal(format!(
                    "unexpected node status '{other}'"
                )));
            }
        };
        result.insert(node_id.clone(), unlock_status);
    }

    // f. Return the map.
    Ok(result)
}

#[cfg(feature = "app")]
#[tauri::command]
pub fn compute_unlock(
    db: State<DbConn>,
    tree_id: String,
) -> Result<HashMap<String, String>, AppError> {
    let conn = db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    compute_unlock_impl(&conn, &tree_id)
}
