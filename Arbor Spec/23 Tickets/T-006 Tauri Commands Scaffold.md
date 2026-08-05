---
id: T-006
phase: 2
status: done
depends_on: [T-002]
---

# T-006 — Tauri command scaffold, seed_graph, and graph query commands

## Goal
The Tauri backend exposes C3 Phase 2 commands: `seed_graph` for loading fixture trees, `list_trees`/`get_tree`/`get_graph`/`get_node`/`get_graph_log` for querying them, `update_node_status` for mutating node state. All commands enforce C1 invariants (pragmas, foreign keys, STRICT mode).

## System prerequisites
None beyond Phase 1 (Rust stable, pnpm, MinGW64 GCC).

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C3 Tauri Commands]] (mirror: `contracts/commands.d.ts`)
- Contract: [[21 Contracts/C1 SQLite Schema]] (mirror: `contracts/schema.sql`)
- Architecture: [[20 Architecture#Error-handling policy]], [[20 Architecture#Module boundaries]], [[20 Architecture#Repository layout]]

## Files
**Create:** `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/trees.rs`, `src-tauri/src/commands/graph.rs`, `src-tauri/src/commands/seed.rs`, `src-tauri/src/errors.rs`
**Modify:** `src-tauri/src/lib.rs` (add `mod commands; mod errors;` + `DbConn` type), `src-tauri/src/main.rs` (move `run()` here with DB state management + `generate_handler!`, gated `#[cfg(feature = "app")]`), `src-tauri/src/db/mod.rs` (add `open_or_init_memory`, update `migrations_dir_path` to use feature flag), `src-tauri/Cargo.toml` (add `serde_json = "1"`, `[features] default = ["app"]`, `[[test]]` entry for T-006)

## Steps

**Convention for all command modules:** every response struct (`TreeSummary`, `Tree`, `Graph`, `GraphNode`, `GraphEdge`, `NodeDetail`, `GraphLogEntry`, `Scope`) must be `pub` and derive `serde::Serialize`. Input structs (`SeedTree`, `SeedNode`, `SeedEdge`, `Scope`) must also derive `serde::Deserialize`. All string fields use `String`, not `&str`.

1. **Create `src-tauri/src/errors.rs`** — define `AppError` as a `thiserror` enum matching the C3 error contract:
   ```rust
   #[derive(Debug, thiserror::Error)]
   pub enum AppError {
       #[error("db.not_found: {0}")]
       NotFound(String),
       #[error("graph.duplicate_node: {0}")]
       DuplicateNode(String),
       #[error("graph.self_loop: {0}")]
       SelfLoop(String),
       #[error("graph.cycle_detected: {0}")]
       CycleDetected(String),
       #[error("graph.dangling_edge: {0}")]
       DanglingEdge(String),
       #[error("graph.invalid_status_transition: {0}")]
       InvalidStatusTransition(String),
       #[error("db.internal: {0}")]
       Internal(String),
   }
   ```
   Implement `serde::Serialize` for `AppError` so it serialises to `{ code, message }` as specified in C3. The `code` field is the prefix before the colon (e.g. `"db.not_found"`); `message` is the human-readable detail after it.

2. **Create `src-tauri/src/commands/mod.rs`** — re-export submodules:
   ```rust
   pub mod trees;
   pub mod graph;
   pub mod seed;
   ```

3. **Create `src-tauri/src/commands/trees.rs`** — each command has two layers: a `pub fn xxx_impl(conn: &rusqlite::Connection, ...) -> Result<T, AppError>` that contains all logic, and a `#[tauri::command] pub fn xxx(db: State<DbConn>, ...) -> Result<T, AppError>` that locks the mutex and delegates. The `_impl` functions are what the pre-written tests call directly (no Tauri runtime needed). Implement:
   - `list_trees_impl(conn) -> Result<Vec<TreeSummary>, AppError>`: query all trees with node counts via `SELECT tree.*, (SELECT COUNT(*) FROM node WHERE tree_id = tree.id) AS node_count, (SELECT COUNT(*) FROM node WHERE tree_id = tree.id AND status = 'completed') AS completed_count FROM tree ORDER BY created_at DESC`.
   - `get_tree_impl(conn, tree_id) -> Result<Tree, AppError>`: fetch a single tree by id; return `AppError::NotFound` if absent. Deserialise `scope_json` into the `scope` struct.

4. **Create `src-tauri/src/commands/graph.rs`** — same two-layer pattern (`_impl` + Tauri wrapper). Implement:
   - `get_graph_impl(conn, tree_id) -> Result<Graph, AppError>`: verify tree exists (else `NotFound`), then query all nodes and edges for that tree. Return `Graph { tree_id, tree_version: tree.version, nodes, edges }`.
   - `get_node_impl(conn, node_id) -> Result<NodeDetail, AppError>`: fetch a single node, deserialising `outcomes_json` and `provenance_json`. Return `NotFound` if absent.
   - `get_graph_log_impl(conn, tree_id, limit: Option<u32>) -> Result<Vec<GraphLogEntry>, AppError>`: verify tree exists, then query `graph_log` for that tree ordered by `id DESC`. Apply `LIMIT` if provided. Deserialise `payload_json`.

5. **Create `src-tauri/src/commands/seed.rs`** — same two-layer pattern. The `SeedTree`, `SeedNode`, `SeedEdge`, and `Scope` structs must be `pub` and derive `serde::Deserialize` (the tests deserialise fixture JSON into them directly). Implement:
   - `seed_graph_impl(conn, seed: SeedTree) -> Result<(), AppError>`: inside a single transaction:
     a. Validate: no duplicate node ids → `DuplicateNode`. No self-loops → `SelfLoop`. All edge endpoints exist in the node list → `DanglingEdge`.
     b. **Cycle detection**: build an adjacency list from edges (parent→child direction) and run a topological sort (Kahn's algorithm or DFS with colouring). If a cycle exists → `CycleDetected`, roll back.
     c. Insert the tree row with `version = 1` and current UTC timestamp.
     d. Insert all node rows with defaults: `status = node.status.unwrap_or("not_started")`, `pack_path = NULL`, `provenance_json = "{}"`, timestamps = now.
     e. Insert all edge rows.
     f. Write `graph_log` entries: one `node_added` per node, one `edge_added` per edge, all with `tree_version = 1`, `actor = "build_pipeline"`.
   - `update_node_status_impl(conn, node_id, status) -> Result<(), AppError>`: inside a transaction:
     a. Fetch the node; `NotFound` if absent.
     b. Validate status is one of `not_started|in_progress|completed`; else `InvalidStatusTransition`.
     c. Update `node.status` and `node.updated_at`.
     d. Bump `tree.version` for the node's tree.
     e. Write a `graph_log` entry with `change_type = "node_updated"`, `entity_id = node_id`, `payload_json` containing old and new status.

6. **Add `open_or_init_memory` to `src-tauri/src/db/mod.rs`** — a test-only variant of `open_or_init` that uses an in-memory SQLite database:
   ```rust
   pub fn open_or_init_memory() -> Result<rusqlite::Connection, DbError> {
       let conn = rusqlite::Connection::open_in_memory()
           .map_err(|e| DbError::Open(e.to_string()))?;
       conn.execute_batch("PRAGMA foreign_keys = ON;")
           .map_err(|e| DbError::Pragma(e.to_string()))?;
       conn.execute_batch("PRAGMA journal_mode = WAL;")
           .map_err(|e| DbError::Pragma(e.to_string()))?;
       migrations::run_migrations(&conn)?;
       Ok(conn)
   }
   ```
   This function is used by the pre-written T-006/T-007/T-008 test files. It must apply the same pragmas and migrations as `open_or_init`.

7. **Modify `src-tauri/src/lib.rs`**:
   - Add `pub mod commands; pub mod errors;`.
   - Create a `DbConn` type wrapping `Mutex<rusqlite::Connection>` for thread-safe Tauri state:
     ```rust
     pub struct DbConn(pub std::sync::Mutex<rusqlite::Connection>);
     ```
   - In `run()`, after `open_or_init`, manage the connection as state: `.manage(DbConn(Mutex::new(conn)))`.
   - Register all commands with `.invoke_handler(tauri::generate_handler![...])`.

8. **Add test entry and dependencies to `src-tauri/Cargo.toml`**: add `serde_json = "1"` to `[dependencies]` if not already present. Add:
   ```toml
   [[test]]
   name = "t006-commands"
   path = "../tests/T-006/commands.rs"
   ```

## Acceptance criteria
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --test t006-commands --no-default-features` passes (pre-written at `tests/T-006/commands.rs`)
- [ ] `pnpm lint` exits 0

## Out of scope — DO NOT
- Do not implement `compute_unlock` — that is T-007.
- Do not add any frontend code, React components, or TypeScript API wrappers.
- Do not add query helpers, ORMs, connection pools, or any abstraction beyond what Steps specify.
- Do not implement authentication, authorization, or any middleware.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners. Use `pnpm list <pkg>` or `Read` tool instead.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

**Created:** `src-tauri/src/errors.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/trees.rs`, `src-tauri/src/commands/graph.rs`, `src-tauri/src/commands/seed.rs`

**Modified:** `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`, `src-tauri/src/db/mod.rs`, `src-tauri/Cargo.toml`

**Architecture deviation from ticket:** the ticket specified `run()` in `lib.rs` gated with `#[cfg(not(test))]`, and Tauri command wrappers similarly gated. On Windows, `#[cfg(not(test))]` does NOT work for integration tests — the library is compiled normally (without `cfg(test)`) as a dependency of the `[[test]]` binary. This caused `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139) at test startup because `tauri::generate_context!()` and `tauri::Builder` pull in WebView2 DLLs.

**Fix (architect-applied):** introduced a cargo feature flag `app` (default-enabled). `run()` moved to `main.rs` (gated `#[cfg(feature = "app")]`). Tauri command wrappers gated `#[cfg(feature = "app")]` instead of `#[cfg(not(test))]`. `db/mod.rs` `migrations_dir_path()` similarly updated. Tests run with `--no-default-features` to exclude the `app` feature. All three Phase 2 ticket acceptance criteria updated.

**Test results:** 14/14 T-006 tests pass. 6/6 T-002 tests pass (no regression). `pnpm lint` exit 0.

## Verification

Verification: pass — 2026-08-05
- tests/T-006/commands.rs: 14/14 passed (cargo test --manifest-path src-tauri/Cargo.toml --test t006-commands --no-default-features)
- pnpm lint: exits 0 (tsc --noEmit + cargo clippy -D warnings both clean)
- Integrity check: no protected paths (contracts/, Arbor Spec/21 Contracts/, tests/T-NNN/*.test.*, .claude/) in git diff 92aba34..550277a
- Files section: all 9 files in diff (5 created, 4 modified) match the ticket's Files section exactly; src-tauri/src/main.rs now listed after architect fix in 6ab1515
- Out-of-scope: no violations (no compute_unlock, no frontend code, no ORMs, no auth)
- C3 contract: AppError serialises to {code, message}; all response structs pub+Serialize; input structs pub+Deserialize; two-layer _impl/wrapper pattern correct; DbConn wraps Mutex<Connection>; all 7 commands registered in generate_handler!