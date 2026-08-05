// tests/T-008/large_fixture.rs
// Pre-written acceptance test for T-008. Do NOT modify this file — make it pass.
//
// Wired via src-tauri/Cargo.toml:
//   [[test]]
//   name = "t008-large-fixture"
//   path = "../tests/T-008/large_fixture.rs"
//
// Run: cargo test --manifest-path src-tauri/Cargo.toml --test t008-large-fixture
//
// Verifies the large fixture tree meets shape constraints required for
// Phase 3 layout testing.

use std::collections::{HashMap, HashSet, VecDeque};
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

// ─── Test 1: fixture loads via seed_graph without error ─────────────────────

#[test]
fn large_fixture_loads() {
    let db = test_db();
    let fixture = read_fixture("large-tree.json");
    let seed: arbor_lib::commands::seed::SeedTree =
        serde_json::from_value(fixture).expect("fixture must deserialise to SeedTree");

    let conn = db.0.lock().unwrap();
    arbor_lib::commands::seed::seed_graph_impl(&conn, seed)
        .expect("seed_graph must succeed on the large fixture (no cycles, no duplicates)");
}

// ─── Test 2: node count in range 55–65 ──────────────────────────────────────

#[test]
fn node_count_in_range() {
    let fixture = read_fixture("large-tree.json");
    let nodes = fixture["nodes"].as_array().expect("nodes must be an array");
    let count = nodes.len();
    assert!(
        (55..=65).contains(&count),
        "node count must be 55–65, got {count}"
    );
}

// ─── Test 3: at least 3 diamond merges ──────────────────────────────────────

#[test]
fn at_least_3_diamond_merges() {
    let fixture = read_fixture("large-tree.json");
    let edges = fixture["edges"].as_array().expect("edges must be an array");

    // Build child→parents map
    let mut child_parents: HashMap<String, Vec<String>> = HashMap::new();
    for edge in edges {
        let parent = edge["parent_id"].as_str().unwrap().to_string();
        let child = edge["child_id"].as_str().unwrap().to_string();
        child_parents.entry(child).or_default().push(parent);
    }

    // A diamond merge is a node with ≥2 parents (two branches converge on it)
    let diamond_count = child_parents.values().filter(|parents| parents.len() >= 2).count();
    assert!(
        diamond_count >= 3,
        "need ≥3 diamond merges (nodes with ≥2 parents), found {diamond_count}"
    );
}

// ─── Test 4: at least one node with 4+ parents (high fan-in) ────────────────

#[test]
fn high_fan_in_node_exists() {
    let fixture = read_fixture("large-tree.json");
    let edges = fixture["edges"].as_array().expect("edges must be an array");

    let mut child_parent_count: HashMap<String, usize> = HashMap::new();
    for edge in edges {
        let child = edge["child_id"].as_str().unwrap().to_string();
        *child_parent_count.entry(child).or_default() += 1;
    }

    let max_fan_in = child_parent_count.values().copied().max().unwrap_or(0);
    assert!(
        max_fan_in >= 4,
        "need ≥1 node with 4+ parents, max fan-in is {max_fan_in}"
    );
}

// ─── Test 5: branch depth variance ≥3 ──────────────────────────────────────

#[test]
fn branch_depth_variance() {
    let fixture = read_fixture("large-tree.json");
    let nodes = fixture["nodes"].as_array().expect("nodes must be an array");
    let edges = fixture["edges"].as_array().expect("edges must be an array");

    let node_ids: HashSet<String> = nodes.iter()
        .map(|n| n["id"].as_str().unwrap().to_string())
        .collect();

    // Build parent→children adjacency list
    let mut children_of: HashMap<String, Vec<String>> = HashMap::new();
    let mut has_parent: HashSet<String> = HashSet::new();
    for edge in edges {
        let parent = edge["parent_id"].as_str().unwrap().to_string();
        let child = edge["child_id"].as_str().unwrap().to_string();
        children_of.entry(parent).or_default().push(child.clone());
        has_parent.insert(child);
    }

    // Roots = nodes with no parent
    let roots: Vec<String> = node_ids.iter()
        .filter(|id| !has_parent.contains(*id))
        .cloned()
        .collect();

    // BFS from each root to find max depth of each root-to-leaf chain
    let mut leaf_depths: Vec<usize> = Vec::new();

    for root in &roots {
        let mut queue: VecDeque<(String, usize)> = VecDeque::new();
        queue.push_back((root.clone(), 0));

        while let Some((node, depth)) = queue.pop_front() {
            let kids = children_of.get(&node);
            if kids.is_none() || kids.unwrap().is_empty() {
                leaf_depths.push(depth);
            } else {
                for kid in kids.unwrap() {
                    queue.push_back((kid.clone(), depth + 1));
                }
            }
        }
    }

    let max_depth = leaf_depths.iter().copied().max().unwrap_or(0);
    let min_depth = leaf_depths.iter().copied().min().unwrap_or(0);
    let variance = max_depth - min_depth;

    assert!(
        variance >= 3,
        "branch depth variance (max_depth - min_depth) must be ≥3, got {variance} (max={max_depth}, min={min_depth})"
    );
}

// ─── Test 6: at least one chain of ≥6 sequential dependencies ──────────────

#[test]
fn deep_chain_exists() {
    let fixture = read_fixture("large-tree.json");
    let edges = fixture["edges"].as_array().expect("edges must be an array");
    let nodes = fixture["nodes"].as_array().expect("nodes must be an array");

    let node_ids: HashSet<String> = nodes.iter()
        .map(|n| n["id"].as_str().unwrap().to_string())
        .collect();

    // Build parent→children adjacency
    let mut children_of: HashMap<String, Vec<String>> = HashMap::new();
    let mut has_parent: HashSet<String> = HashSet::new();
    for edge in edges {
        let parent = edge["parent_id"].as_str().unwrap().to_string();
        let child = edge["child_id"].as_str().unwrap().to_string();
        children_of.entry(parent).or_default().push(child.clone());
        has_parent.insert(child);
    }

    // Find longest path via DFS with memoisation
    let mut memo: HashMap<String, usize> = HashMap::new();

    fn longest_path(
        node: &str,
        children_of: &HashMap<String, Vec<String>>,
        memo: &mut HashMap<String, usize>,
    ) -> usize {
        if let Some(&cached) = memo.get(node) {
            return cached;
        }
        let max_child = children_of
            .get(node)
            .map(|kids| kids.iter().map(|k| longest_path(k, children_of, memo)).max().unwrap_or(0))
            .unwrap_or(0);
        let result = 1 + max_child;
        memo.insert(node.to_string(), result);
        result
    }

    let max_chain = node_ids.iter()
        .map(|id| longest_path(id, &children_of, &mut memo))
        .max()
        .unwrap_or(0);

    assert!(
        max_chain >= 7,
        "need at least one chain of ≥6 edges (≥7 nodes), longest chain has {max_chain} nodes"
    );
}

// ─── Test 7: at least one node with ≥5 direct children (wide fan-out) ───────

#[test]
fn wide_fan_out_exists() {
    let fixture = read_fixture("large-tree.json");
    let edges = fixture["edges"].as_array().expect("edges must be an array");

    let mut parent_child_count: HashMap<String, usize> = HashMap::new();
    for edge in edges {
        let parent = edge["parent_id"].as_str().unwrap().to_string();
        *parent_child_count.entry(parent).or_default() += 1;
    }

    let max_fan_out = parent_child_count.values().copied().max().unwrap_or(0);
    assert!(
        max_fan_out >= 5,
        "need ≥1 node with ≥5 direct children, max fan-out is {max_fan_out}"
    );
}

// ─── Test 8: at least 4 distinct categories ─────────────────────────────────

#[test]
fn at_least_4_categories() {
    let fixture = read_fixture("large-tree.json");
    let nodes = fixture["nodes"].as_array().expect("nodes must be an array");

    let categories: HashSet<String> = nodes.iter()
        .map(|n| n["category"].as_str().unwrap().to_string())
        .collect();

    assert!(
        categories.len() >= 4,
        "need ≥4 distinct categories, found {}: {:?}",
        categories.len(),
        categories
    );
}

// ─── Test 9: all node statuses are not_started ──────────────────────────────

#[test]
fn all_nodes_not_started() {
    let fixture = read_fixture("large-tree.json");
    let nodes = fixture["nodes"].as_array().expect("nodes must be an array");

    for node in nodes {
        let id = node["id"].as_str().unwrap();
        let status = node.get("status").and_then(|s| s.as_str()).unwrap_or("not_started");
        assert_eq!(
            status, "not_started",
            "node '{id}' must have status 'not_started' in the layout fixture"
        );
    }
}
