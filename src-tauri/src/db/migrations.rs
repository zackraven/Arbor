use rusqlite::Connection;
use std::path::Path;

use super::DbError;

/// Bootstrap: create schema_migrations if it does not exist yet.
fn bootstrap_migrations_table(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version    INTEGER NOT NULL,
            applied_at TEXT    NOT NULL,
            PRIMARY KEY (version)
        ) STRICT;",
    )
    .map_err(DbError::Rusqlite)
}

/// Return the set of already-applied version numbers.
fn applied_versions(conn: &Connection) -> Result<Vec<i64>, DbError> {
    let mut stmt = conn
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .map_err(DbError::Rusqlite)?;
    let rows = stmt
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(DbError::Rusqlite)?;
    let mut versions = Vec::new();
    for row in rows {
        versions.push(row.map_err(DbError::Rusqlite)?);
    }
    Ok(versions)
}

/// Parse the version number from a migration filename.
/// Expected format: `<NNNN>_<anything>.sql`  →  version = NNNN
fn parse_version(filename: &str) -> Option<i64> {
    filename
        .split('_')
        .next()
        .and_then(|s| s.parse::<i64>().ok())
}

/// Apply all pending migration files found in `migrations_dir`, in filename order.
/// Each migration is applied inside its own transaction.
/// Re-running on an already-initialised DB is a no-op.
pub fn run_migrations(conn: &Connection, migrations_dir: &Path) -> Result<(), DbError> {
    bootstrap_migrations_table(conn)?;

    let applied = applied_versions(conn)?;

    // Collect migration files
    let read_dir = std::fs::read_dir(migrations_dir).map_err(DbError::Io)?;
    let mut entries: Vec<(String, std::path::PathBuf)> = read_dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let name = path.file_name()?.to_string_lossy().into_owned();
            if name.ends_with(".sql") {
                Some((name, path))
            } else {
                None
            }
        })
        .collect();

    // Sort by filename to guarantee order
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    for (filename, path) in entries {
        let version = parse_version(&filename)
            .ok_or_else(|| DbError::MigrationFilename(filename.clone()))?;

        // Skip already-applied versions
        if applied.contains(&version) {
            continue;
        }

        let sql = std::fs::read_to_string(&path).map_err(DbError::Io)?;

        // Apply in its own transaction
        conn.execute_batch("BEGIN;").map_err(DbError::Rusqlite)?;
        match conn.execute_batch(&sql) {
            Ok(()) => {}
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                return Err(DbError::Rusqlite(e));
            }
        }

        // Record the applied version
        let now = chrono_now();
        match conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![version, now],
        ) {
            Ok(_) => {}
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                return Err(DbError::Rusqlite(e));
            }
        }

        conn.execute_batch("COMMIT;").map_err(DbError::Rusqlite)?;
    }

    Ok(())
}

/// Return current UTC time as an ISO 8601 string.
fn chrono_now() -> String {
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

// ─── Unit tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_or_init;
    use std::path::PathBuf;

    fn migrations_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations")
    }

    fn open_memory_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
            .unwrap();
        conn
    }

    /// Re-running open_or_init on an already-initialised DB is a no-op.
    #[test]
    fn rerun_is_noop() {
        let conn = open_memory_conn();
        let dir = migrations_dir();

        run_migrations(&conn, &dir).expect("first run should succeed");
        run_migrations(&conn, &dir).expect("second run should be a no-op");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "schema_migrations should have exactly 1 row after double-apply");
    }

    /// Calling open_or_init on a DB that has schema_migrations recording version 1
    /// applied but is missing a required table returns Err.
    #[test]
    fn missing_table_after_recorded_version_is_err() {
        // Use a temp file in the OS temp dir; no external crate needed.
        let tmp_dir = std::env::temp_dir();
        let db_path = tmp_dir.join(format!(
            "arbor_test_{}.db",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));

        // First open: initialises normally
        {
            let conn = open_or_init(&db_path).expect("first open_or_init must succeed");
            // Simulate corruption: drop a core table
            conn.execute_batch("PRAGMA foreign_keys = OFF; DROP TABLE tree;")
                .unwrap();
        }

        // Second open: version 1 is recorded in schema_migrations, but 'tree' is missing → Err
        let result = open_or_init(&db_path);

        // Clean up temp file before asserting (best effort)
        let _ = std::fs::remove_file(&db_path);

        assert!(
            result.is_err(),
            "open_or_init must return Err when schema_migrations records version 1 but required tables are missing"
        );
    }
}
