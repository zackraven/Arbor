use rusqlite::Connection;
use serde::Serialize;

#[cfg(feature = "app")]
use tauri::State;

#[cfg(feature = "app")]
use crate::DbConn;

use crate::errors::AppError;

#[derive(Debug, Serialize)]
pub struct TreeSummary {
    pub id: String,
    pub title: String,
    pub node_count: i64,
    pub completed_count: i64,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, serde::Deserialize)]
pub struct Scope {
    pub top_bubble: String,
    pub categories: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct Tree {
    pub id: String,
    pub title: String,
    pub scope: Scope,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list_trees_impl(conn: &Connection) -> Result<Vec<TreeSummary>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT tree.id, tree.title, tree.version, tree.created_at, tree.updated_at, \
             (SELECT COUNT(*) FROM node WHERE tree_id = tree.id) AS node_count, \
             (SELECT COUNT(*) FROM node WHERE tree_id = tree.id AND status = 'completed') AS completed_count \
             FROM tree ORDER BY created_at DESC",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let trees = stmt
        .query_map([], |row| {
            Ok(TreeSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                version: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                node_count: row.get(5)?,
                completed_count: row.get(6)?,
            })
        })
        .map_err(|e| AppError::Internal(e.to_string()))?
        .map(|r| r.map_err(|e| AppError::Internal(e.to_string())))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(trees)
}

pub fn get_tree_impl(conn: &Connection, tree_id: &str) -> Result<Tree, AppError> {
    let result = conn.query_row(
        "SELECT id, title, scope_json, version, created_at, updated_at FROM tree WHERE id = ?1",
        [tree_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        },
    );

    match result {
        Ok((id, title, scope_json, version, created_at, updated_at)) => {
            let scope: Scope = serde_json::from_str(&scope_json)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            Ok(Tree {
                id,
                title,
                scope,
                version,
                created_at,
                updated_at,
            })
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err(AppError::NotFound(format!("tree '{tree_id}' not found")))
        }
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}

#[cfg(feature = "app")]
#[tauri::command]
pub fn list_trees(db: State<DbConn>) -> Result<Vec<TreeSummary>, AppError> {
    let conn = db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    list_trees_impl(&conn)
}

#[cfg(feature = "app")]
#[tauri::command]
pub fn get_tree(db: State<DbConn>, tree_id: String) -> Result<Tree, AppError> {
    let conn = db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    get_tree_impl(&conn, &tree_id)
}
