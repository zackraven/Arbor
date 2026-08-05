pub mod migrations;

use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Rusqlite(#[from] rusqlite::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("migration filename could not be parsed: {0}")]
    MigrationFilename(String),

    #[error("schema integrity check failed: required table missing after migration")]
    SchemaMissing,

    #[error("failed to open database: {0}")]
    Open(String),

    #[error("failed to set pragma: {0}")]
    Pragma(String),
}

/// Tables that must exist after all migrations have been applied.
const REQUIRED_TABLES: &[&str] = &[
    "schema_migrations",
    "tree",
    "node",
    "edge",
    "graph_log",
    "progress",
    "card",
    "review",
    "repair_report",
    "test",
    "build_state",
    "setting",
];

/// Open (or create) the SQLite database at `path`, set connection pragmas,
/// run all pending migrations, and verify schema integrity.
pub fn open_or_init(path: &Path) -> Result<rusqlite::Connection, DbError> {
    let conn = rusqlite::Connection::open(path).map_err(DbError::Rusqlite)?;

    // Per-connection pragmas
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .map_err(DbError::Rusqlite)?;

    // Resolve the migrations directory relative to the binary's manifest dir.
    // In production this is next to the binary; in tests CARGO_MANIFEST_DIR is set.
    let migrations_dir = migrations_dir_path();
    migrations::run_migrations(&conn, &migrations_dir)?;

    // Integrity check: every required table must exist
    for table in REQUIRED_TABLES {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [table],
                |row| row.get(0),
            )
            .map_err(DbError::Rusqlite)?;
        if count == 0 {
            return Err(DbError::SchemaMissing);
        }
    }

    Ok(conn)
}

/// Open an in-memory SQLite database, apply pragmas, and run migrations.
/// Used by test suites (T-006, T-007, T-008) that need a fresh DB per test.
pub fn open_or_init_memory() -> Result<rusqlite::Connection, DbError> {
    let conn = rusqlite::Connection::open_in_memory()
        .map_err(|e| DbError::Open(e.to_string()))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| DbError::Pragma(e.to_string()))?;
    conn.execute_batch("PRAGMA journal_mode = WAL;")
        .map_err(|e| DbError::Pragma(e.to_string()))?;
    let migrations_dir = migrations_dir_path();
    migrations::run_migrations(&conn, &migrations_dir)?;
    Ok(conn)
}

fn migrations_dir_path() -> std::path::PathBuf {
    // CARGO_MANIFEST_DIR is available at compile time in test/dev builds.
    // In production (release without the env var), fall back to exe-relative.
    #[cfg(feature = "app")]
    {
        let exe = std::env::current_exe().unwrap_or_default();
        exe.parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join("migrations")
    }
    #[cfg(not(feature = "app"))]
    {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations")
    }
}
