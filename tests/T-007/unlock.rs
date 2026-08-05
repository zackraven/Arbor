// tests/T-007/unlock.rs
// Pre-written acceptance test for T-007. Do NOT modify this file — make it pass.
//
// Wired via src-tauri/Cargo.toml:
//   [[test]]
//   name = "t007-unlock"
//   path = "../tests/T-007/unlock.rs"
//
// Run: cargo test --manifest-path src-tauri/Cargo.toml --test t007-unlock
//
// Tests the compute_unlock command against the small fixture tree with
// hand-verified expected unlock statuses.

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

fn test_db() -> arbor_lib::DbConn {
    let conn = arbor_lib::db::open_or_init_memory()
        .expect("failed to open in-memory test DB");
    arbor_lib::DbConn(Mutex::new(conn))
}

fn seed_small_fixture(conn: &rusqlite::Connection) {
    let mut fixture = read_fixture("small-tree.json");
    fixture.as_object_mut().unwrap().remove("_test_notes");
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");
    arbor_lib::commands::seed::seed_graph_impl(conn, seed)
        .expect("seed_graph must succeed on the small fixture");
}

fn expected_unlock_statuses() -> HashMap<String, String> {
    // Hand-verified expected unlock statuses from the fixture's _test_notes.
    // The rule: completed/in_progress pass through; not_started nodes are
    // 'unlocked' iff ALL children have status=completed, else 'locked'.
    // Leaf nodes with status=not_started are 'unlocked'.
    let pairs = [
        ("newtons-laws", "completed"),
        ("energy-conservation", "completed"),
        ("partial-derivatives", "completed"),
        ("integration-techniques", "completed"),
        ("vectors-and-coordinates", "completed"),
        ("work-and-energy", "in_progress"),
        ("constraints", "unlocked"),
        ("calculus-of-variations", "unlocked"),
        ("dalembert-principle", "locked"),
        ("euler-lagrange", "locked"),
        ("generalized-coords", "locked"),
        ("lagrangian-mechanics", "locked"),
    ];
    pairs.into_iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
}

// ─── Test 1: compute_unlock matches hand-verified expected states ───────────

#[test]
fn compute_unlock_initial_state() {
    let db = test_db();
    let conn = db.0.lock().unwrap();
    seed_small_fixture(&conn);

    let result = arbor_lib::commands::unlock::compute_unlock_impl(&conn, "classical-mechanics")
        .expect("compute_unlock must succeed");

    let expected = expected_unlock_statuses();
    assert_eq!(result.len(), expected.len(), "must return status for every node");

    for (node_id, expected_status) in &expected {
        let actual = result.get(node_id)
            .unwrap_or_else(|| panic!("missing node {node_id} in unlock result"));
        assert_eq!(
            actual, expected_status,
            "node '{node_id}': expected '{expected_status}', got '{actual}'"
        );
    }
}

// ─── Test 2: completing 'constraints' unlocks 'generalized-coords' ──────────

#[test]
fn completing_constraints_unlocks_generalized_coords() {
    let db = test_db();
    let conn = db.0.lock().unwrap();
    seed_small_fixture(&conn);

    // Before: generalized-coords is locked (child 'constraints' is not_started)
    let before = arbor_lib::commands::unlock::compute_unlock_impl(&conn, "classical-mechanics")
        .unwrap();
    assert_eq!(before["generalized-coords"], "locked");

    // Complete 'constraints'
    arbor_lib::commands::seed::update_node_status_impl(&conn, "constraints", "completed")
        .expect("update_node_status must succeed");

    // After: generalized-coords should be unlocked (both children now completed)
    let after = arbor_lib::commands::unlock::compute_unlock_impl(&conn, "classical-mechanics")
        .unwrap();
    assert_eq!(
        after["generalized-coords"], "unlocked",
        "generalized-coords must be unlocked after constraints is completed"
    );
}

// ─── Test 3: completing 'constraints' does NOT unlock 'dalembert-principle' ──

#[test]
fn completing_constraints_does_not_unlock_dalembert() {
    let db = test_db();
    let conn = db.0.lock().unwrap();
    seed_small_fixture(&conn);

    // Complete 'constraints'
    arbor_lib::commands::seed::update_node_status_impl(&conn, "constraints", "completed")
        .unwrap();

    // dalembert-principle has three children: newtons-laws (completed),
    // constraints (now completed), work-and-energy (in_progress).
    // work-and-energy is NOT completed → dalembert-principle stays locked.
    let after = arbor_lib::commands::unlock::compute_unlock_impl(&conn, "classical-mechanics")
        .unwrap();
    assert_eq!(
        after["dalembert-principle"], "locked",
        "dalembert-principle must stay locked (work-and-energy still in_progress)"
    );
}

// ─── Test 4: completing 'work-and-energy' + 'constraints' unlocks 'dalembert'

#[test]
fn completing_work_and_energy_and_constraints_unlocks_dalembert() {
    let db = test_db();
    let conn = db.0.lock().unwrap();
    seed_small_fixture(&conn);

    // Complete both remaining children of dalembert-principle
    arbor_lib::commands::seed::update_node_status_impl(&conn, "constraints", "completed")
        .unwrap();
    arbor_lib::commands::seed::update_node_status_impl(&conn, "work-and-energy", "completed")
        .unwrap();

    // Now all three children of dalembert-principle are completed:
    // newtons-laws (completed), constraints (completed), work-and-energy (completed)
    let after = arbor_lib::commands::unlock::compute_unlock_impl(&conn, "classical-mechanics")
        .unwrap();
    assert_eq!(
        after["dalembert-principle"], "unlocked",
        "dalembert-principle must be unlocked after all children completed"
    );
}

// ─── Test 5: compute_unlock returns NotFound for unknown tree ───────────────

#[test]
fn compute_unlock_not_found() {
    let db = test_db();
    let conn = db.0.lock().unwrap();

    let result = arbor_lib::commands::unlock::compute_unlock_impl(&conn, "nonexistent");
    assert!(result.is_err(), "compute_unlock must fail for nonexistent tree");
}

// ─── Test 6: leaf nodes with not_started are unlocked ───────────────────────

#[test]
fn leaf_nodes_are_unlocked() {
    let db = test_db();
    let conn = db.0.lock().unwrap();

    // Seed a minimal tree with a single leaf node (no children)
    let seed = arbor_lib::commands::seed::SeedTree {
        id: "leaf-test".into(),
        title: "Leaf Test".into(),
        scope: arbor_lib::commands::seed::Scope {
            top_bubble: "test".into(),
            categories: vec!["cat".into()],
        },
        nodes: vec![arbor_lib::commands::seed::SeedNode {
            id: "leaf".into(),
            title: "Leaf".into(),
            one_liner: "a leaf".into(),
            category: "cat".into(),
            outcomes: vec!["o".into()],
            status: None, // defaults to not_started
        }],
        edges: vec![],
    };

    arbor_lib::commands::seed::seed_graph_impl(&conn, seed).unwrap();

    let result = arbor_lib::commands::unlock::compute_unlock_impl(&conn, "leaf-test").unwrap();
    assert_eq!(result["leaf"], "unlocked", "leaf node with not_started must be unlocked");
}
