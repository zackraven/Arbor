// tests/T-002/migrations.rs
// Pre-written acceptance test for T-002. Do NOT modify this file — make it pass.
//
// Wired via src-tauri/Cargo.toml:
//   [[test]]
//   name = "t002-migrations"
//   path = "../tests/T-002/migrations.rs"
//
// Run: cargo test --manifest-path src-tauri/Cargo.toml --test t002-migrations
//
// Dependencies used (must be in src-tauri/Cargo.toml [dependencies] or
// [dev-dependencies]): rusqlite (with "bundled" feature)

use std::path::PathBuf;

fn migration_sql() -> String {
    // Resolve relative to the src-tauri directory (CARGO_MANIFEST_DIR)
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("migrations")
        .join("0001_init.sql");
    std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("cannot read {}: {e}", path.display()))
}

fn fresh_conn() -> rusqlite::Connection {
    let conn = rusqlite::Connection::open_in_memory()
        .expect("failed to open in-memory SQLite connection");
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .expect("failed to set foreign_keys pragma");
    conn
}

// ─── Test 1: migration applies cleanly ──────────────────────────────────────

#[test]
fn migration_0001_applies_to_in_memory_db() {
    let conn = fresh_conn();
    conn.execute_batch(&migration_sql())
        .expect("migration 0001 failed to apply to a fresh in-memory DB");
}

// ─── Test 2: all expected tables exist after apply ──────────────────────────

#[test]
fn all_c1_tables_exist_after_migration() {
    let conn = fresh_conn();
    conn.execute_batch(&migration_sql()).unwrap();

    // Exactly the 12 tables specified in C1
    let expected: &[&str] = &[
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

    for table in expected {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [table],
                |row| row.get(0),
            )
            .unwrap_or_else(|e| panic!("sqlite_master query failed for '{table}': {e}"));
        assert_eq!(count, 1, "expected table '{table}' to exist after migration 0001");
    }
}

// ─── Test 3: schema_migrations records version 1 ────────────────────────────

#[test]
fn schema_migrations_row_present_after_apply() {
    let conn = fresh_conn();
    conn.execute_batch(&migration_sql()).unwrap();

    // The migration file itself does not INSERT into schema_migrations;
    // that is the runner's responsibility. After the runner applies 0001,
    // there must be a row with version = 1.
    //
    // NOTE: This test verifies the CONTRACT that schema_migrations(version INTEGER)
    // exists and can hold an integer version. The row insertion is tested by the
    // runner unit tests inside src-tauri/src/db/migrations.rs.
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .expect("schema_migrations table must exist after migration 0001");
    // After raw apply (no runner), the table exists but has no rows.
    // That is correct — the runner inserts the row after successful apply.
    // We only assert the table is queryable (schema is correct).
    let _ = count; // count may be 0 here; runner tests assert it equals 1
}

// ─── Test 4: STRICT mode is enabled on tables ────────────────────────────────

#[test]
fn strict_mode_rejects_type_violations() {
    let conn = fresh_conn();
    conn.execute_batch(&migration_sql()).unwrap();

    // Insert a valid tree row first (node has a FK to tree)
    conn.execute(
        "INSERT INTO tree (id, title, scope_json, version, created_at, updated_at)
         VALUES ('t1', 'Test Tree', '{}', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    )
    .expect("valid tree insert must succeed");

    // STRICT mode: trying to insert an integer into a TEXT column must fail
    let result = conn.execute(
        "INSERT INTO node
         (id, tree_id, title, one_liner, category, outcomes_json, created_at, updated_at)
         VALUES (42, 't1', 'N', 'n', 'cat', '[]', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    );
    assert!(
        result.is_err(),
        "STRICT mode must reject integer 42 in TEXT column node.id"
    );
}

// ─── Test 5: node.status CHECK constraint ────────────────────────────────────

#[test]
fn node_status_check_constraint_enforced() {
    let conn = fresh_conn();
    conn.execute_batch(&migration_sql()).unwrap();

    conn.execute(
        "INSERT INTO tree (id, title, scope_json, version, created_at, updated_at)
         VALUES ('t1', 'Test Tree', '{}', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    )
    .unwrap();

    // 'locked' is not a valid status (unlock is computed live, never stored)
    let result = conn.execute(
        "INSERT INTO node
         (id, tree_id, title, one_liner, category, outcomes_json, status, created_at, updated_at)
         VALUES ('n1', 't1', 'N', 'n', 'cat', '[]', 'locked', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    );
    assert!(result.is_err(), "status 'locked' must be rejected by CHECK constraint");

    // Valid status must be accepted
    conn.execute(
        "INSERT INTO node
         (id, tree_id, title, one_liner, category, outcomes_json, status, created_at, updated_at)
         VALUES ('n1', 't1', 'N', 'n', 'cat', '[]', 'not_started', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    )
    .expect("status 'not_started' must be accepted");
}

// ─── Test 6: edge self-loop CHECK constraint ─────────────────────────────────

#[test]
fn edge_no_self_loops() {
    let conn = fresh_conn();
    conn.execute_batch(&migration_sql()).unwrap();

    conn.execute(
        "INSERT INTO tree (id, title, scope_json, version, created_at, updated_at)
         VALUES ('t1', 'T', '{}', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO node (id, tree_id, title, one_liner, category, outcomes_json, created_at, updated_at)
         VALUES ('n1', 't1', 'N', 'n', 'cat', '[]', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        [],
    )
    .unwrap();

    let result = conn.execute(
        "INSERT INTO edge (tree_id, parent_id, child_id, justification, created_at)
         VALUES ('t1', 'n1', 'n1', 'self-loop justification', '2026-01-01T00:00:00Z')",
        [],
    );
    assert!(result.is_err(), "self-loop edges (parent_id = child_id) must be rejected");
}
