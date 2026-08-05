// tests/T-006/commands.rs
// Pre-written acceptance test for T-006. Do NOT modify this file — make it pass.
//
// Wired via src-tauri/Cargo.toml:
//   [[test]]
//   name = "t006-commands"
//   path = "../tests/T-006/commands.rs"
//
// Run: cargo test --manifest-path src-tauri/Cargo.toml --test t006-commands
//
// These tests exercise Tauri commands at the Rust function level (no Tauri
// runtime). They call the command functions directly with a real in-memory
// SQLite connection.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

// ─── Helpers ────────────────────────────────────────────────────────────────

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tests")
        .join("fixtures")
        .join(name)
}

fn read_fixture(name: &str) -> serde_json::Value {
    let path = fixture_path(name);
    let data = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("cannot read fixture {}: {e}", path.display()));
    serde_json::from_str(&data)
        .unwrap_or_else(|e| panic!("invalid JSON in {}: {e}", path.display()))
}

/// Create a fresh in-memory DB with migrations applied, wrapped in DbConn.
fn test_db() -> arbor_lib::DbConn {
    let conn = arbor_lib::db::open_or_init_memory()
        .expect("failed to open in-memory test DB");
    arbor_lib::DbConn(Mutex::new(conn))
}

/// Parse the small fixture into a SeedTree for use with seed_graph.
fn small_fixture_seed() -> serde_json::Value {
    let mut fixture = read_fixture("small-tree.json");
    // Remove _test_notes — not part of SeedTree
    fixture.as_object_mut().unwrap().remove("_test_notes");
    fixture
}

// ─── Test 1: seed_graph loads the small fixture without error ───────────────

#[test]
fn seed_graph_loads_small_fixture() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed)
        .expect("seed_graph must succeed on the small fixture");
}

// ─── Test 2: list_trees returns the seeded tree ─────────────────────────────

#[test]
fn list_trees_returns_seeded_tree() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    let trees = arbor_lib::commands::trees::list_trees_impl(&conn)
        .expect("list_trees must succeed");
    assert_eq!(trees.len(), 1, "expected exactly one tree");
    assert_eq!(trees[0].id, "classical-mechanics");
    assert_eq!(trees[0].node_count, 12);
    // 5 nodes are completed in the fixture
    assert_eq!(trees[0].completed_count, 5);
}

// ─── Test 3: get_tree returns correct tree details ──────────────────────────

#[test]
fn get_tree_returns_details() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    let tree = arbor_lib::commands::trees::get_tree_impl(&conn, "classical-mechanics")
        .expect("get_tree must succeed for seeded tree");
    assert_eq!(tree.title, "Classical Mechanics");
    assert_eq!(tree.version, 1);
    assert_eq!(tree.scope.categories.len(), 2);
}

// ─── Test 4: get_tree returns NotFound for unknown id ───────────────────────

#[test]
fn get_tree_not_found() {
    let db = test_db();
    let conn = db.0.lock().unwrap();

    let result = arbor_lib::commands::trees::get_tree_impl(&conn, "nonexistent");
    assert!(result.is_err(), "get_tree must fail for nonexistent tree");
    let err = result.unwrap_err();
    assert!(
        format!("{err}").contains("not_found"),
        "error must be NotFound, got: {err}"
    );
}

// ─── Test 5: get_graph returns all nodes and edges ──────────────────────────

#[test]
fn get_graph_returns_full_graph() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    let graph = arbor_lib::commands::graph::get_graph_impl(&conn, "classical-mechanics")
        .expect("get_graph must succeed");
    assert_eq!(graph.nodes.len(), 12, "fixture has 12 nodes");
    assert_eq!(graph.edges.len(), 14, "fixture has 14 edges");
    assert_eq!(graph.tree_version, 1);
}

// ─── Test 6: get_node returns correct node details ──────────────────────────

#[test]
fn get_node_returns_details() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    let node = arbor_lib::commands::graph::get_node_impl(&conn, "euler-lagrange")
        .expect("get_node must succeed for seeded node");
    assert_eq!(node.title, "Euler-Lagrange Equation");
    assert_eq!(node.status, "not_started");
    assert_eq!(node.outcomes.len(), 3);
    assert!(node.pack_path.is_none());
}

// ─── Test 7: get_graph_log has entries after seed ────────────────────────────

#[test]
fn get_graph_log_has_entries() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    let log = arbor_lib::commands::graph::get_graph_log_impl(&conn, "classical-mechanics", None)
        .expect("get_graph_log must succeed");
    // 12 node_added + 14 edge_added = 26 entries
    assert_eq!(log.len(), 26, "expected 26 graph_log entries (12 nodes + 14 edges)");

    let node_added_count = log.iter().filter(|e| e.change_type == "node_added").count();
    let edge_added_count = log.iter().filter(|e| e.change_type == "edge_added").count();
    assert_eq!(node_added_count, 12);
    assert_eq!(edge_added_count, 14);
}

// ─── Test 8: get_graph_log respects limit ───────────────────────────────────

#[test]
fn get_graph_log_limit() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    let log = arbor_lib::commands::graph::get_graph_log_impl(
        &conn,
        "classical-mechanics",
        Some(5),
    )
    .expect("get_graph_log with limit must succeed");
    assert_eq!(log.len(), 5, "limit=5 should return exactly 5 entries");
}

// ─── Test 9: update_node_status changes status + bumps version ──────────────

#[test]
fn update_node_status_works() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    // Update constraints from not_started to in_progress
    arbor_lib::commands::seed::update_node_status_impl(&conn, "constraints", "in_progress")
        .expect("update_node_status must succeed");

    // Verify node status changed
    let node = arbor_lib::commands::graph::get_node_impl(&conn, "constraints").unwrap();
    assert_eq!(node.status, "in_progress");

    // Verify tree version bumped
    let tree = arbor_lib::commands::trees::get_tree_impl(&conn, "classical-mechanics").unwrap();
    assert_eq!(tree.version, 2, "tree version must bump after status update");
}

// ─── Test 10: update_node_status rejects invalid status ─────────────────────

#[test]
fn update_node_status_rejects_invalid() {
    let db = test_db();
    let fixture = small_fixture_seed();
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    let result = arbor_lib::commands::seed::update_node_status_impl(
        &conn,
        "constraints",
        "locked",
    );
    assert!(result.is_err(), "update_node_status must reject 'locked'");
}

// ─── Test 11: seed_graph rejects duplicate node ids ─────────────────────────

#[test]
fn seed_graph_rejects_duplicates() {
    let db = test_db();
    let conn = db.0.lock().unwrap();

    let seed = arbor_lib::commands::seed::SeedTree {
        id: "test-tree".into(),
        title: "Test".into(),
        scope: arbor_lib::commands::seed::Scope {
            top_bubble: "test".into(),
            categories: vec!["cat".into()],
        },
        nodes: vec![
            arbor_lib::commands::seed::SeedNode {
                id: "a".into(),
                title: "A".into(),
                one_liner: "a".into(),
                category: "cat".into(),
                outcomes: vec!["o".into()],
                status: None,
            },
            arbor_lib::commands::seed::SeedNode {
                id: "a".into(), // duplicate!
                title: "A2".into(),
                one_liner: "a2".into(),
                category: "cat".into(),
                outcomes: vec!["o".into()],
                status: None,
            },
        ],
        edges: vec![],
    };

    let result = arbor_lib::commands::seed::seed_graph_impl(&conn, seed);
    assert!(result.is_err(), "seed_graph must reject duplicate node ids");
    let err = format!("{}", result.unwrap_err());
    assert!(err.contains("duplicate_node"), "error must be DuplicateNode, got: {err}");
}

// ─── Test 12: seed_graph rejects self-loops ─────────────────────────────────

#[test]
fn seed_graph_rejects_self_loops() {
    let db = test_db();
    let conn = db.0.lock().unwrap();

    let seed = arbor_lib::commands::seed::SeedTree {
        id: "test-tree".into(),
        title: "Test".into(),
        scope: arbor_lib::commands::seed::Scope {
            top_bubble: "test".into(),
            categories: vec!["cat".into()],
        },
        nodes: vec![arbor_lib::commands::seed::SeedNode {
            id: "a".into(),
            title: "A".into(),
            one_liner: "a".into(),
            category: "cat".into(),
            outcomes: vec!["o".into()],
            status: None,
        }],
        edges: vec![arbor_lib::commands::seed::SeedEdge {
            parent_id: "a".into(),
            child_id: "a".into(), // self-loop!
            justification: "test".into(),
        }],
    };

    let result = arbor_lib::commands::seed::seed_graph_impl(&conn, seed);
    assert!(result.is_err(), "seed_graph must reject self-loops");
    let err = format!("{}", result.unwrap_err());
    assert!(err.contains("self_loop"), "error must be SelfLoop, got: {err}");
}

// ─── Test 13: seed_graph rejects dangling edges ─────────────────────────────

#[test]
fn seed_graph_rejects_dangling_edges() {
    let db = test_db();
    let conn = db.0.lock().unwrap();

    let seed = arbor_lib::commands::seed::SeedTree {
        id: "test-tree".into(),
        title: "Test".into(),
        scope: arbor_lib::commands::seed::Scope {
            top_bubble: "test".into(),
            categories: vec!["cat".into()],
        },
        nodes: vec![arbor_lib::commands::seed::SeedNode {
            id: "a".into(),
            title: "A".into(),
            one_liner: "a".into(),
            category: "cat".into(),
            outcomes: vec!["o".into()],
            status: None,
        }],
        edges: vec![arbor_lib::commands::seed::SeedEdge {
            parent_id: "a".into(),
            child_id: "nonexistent".into(), // dangling!
            justification: "test".into(),
        }],
    };

    let result = arbor_lib::commands::seed::seed_graph_impl(&conn, seed);
    assert!(result.is_err(), "seed_graph must reject dangling edges");
    let err = format!("{}", result.unwrap_err());
    assert!(err.contains("dangling_edge"), "error must be DanglingEdge, got: {err}");
}

// ─── Test 14: seed_graph rejects cycles ─────────────────────────────────────

#[test]
fn seed_graph_rejects_cycles() {
    let db = test_db();
    let conn = db.0.lock().unwrap();

    let seed = arbor_lib::commands::seed::SeedTree {
        id: "test-tree".into(),
        title: "Test".into(),
        scope: arbor_lib::commands::seed::Scope {
            top_bubble: "test".into(),
            categories: vec!["cat".into()],
        },
        nodes: vec![
            arbor_lib::commands::seed::SeedNode {
                id: "a".into(),
                title: "A".into(),
                one_liner: "a".into(),
                category: "cat".into(),
                outcomes: vec!["o".into()],
                status: None,
            },
            arbor_lib::commands::seed::SeedNode {
                id: "b".into(),
                title: "B".into(),
                one_liner: "b".into(),
                category: "cat".into(),
                outcomes: vec!["o".into()],
                status: None,
            },
            arbor_lib::commands::seed::SeedNode {
                id: "c".into(),
                title: "C".into(),
                one_liner: "c".into(),
                category: "cat".into(),
                outcomes: vec!["o".into()],
                status: None,
            },
        ],
        edges: vec![
            arbor_lib::commands::seed::SeedEdge {
                parent_id: "a".into(),
                child_id: "b".into(),
                justification: "test".into(),
            },
            arbor_lib::commands::seed::SeedEdge {
                parent_id: "b".into(),
                child_id: "c".into(),
                justification: "test".into(),
            },
            arbor_lib::commands::seed::SeedEdge {
                parent_id: "c".into(),
                child_id: "a".into(), // cycle!
                justification: "test".into(),
            },
        ],
    };

    let result = arbor_lib::commands::seed::seed_graph_impl(&conn, seed);
    assert!(result.is_err(), "seed_graph must reject cycles");
    let err = format!("{}", result.unwrap_err());
    assert!(err.contains("cycle_detected"), "error must be CycleDetected, got: {err}");
}
