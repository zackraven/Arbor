---
id: T-007
phase: 2
status: queued
depends_on: [T-006]
---

# T-007 — Live unlock computation

## Goal
The `compute_unlock` Tauri command returns the correct unlock status for every node in a tree, computed live from the graph. The 12-node fixture tree exercises all four status values (locked, unlocked, in_progress, completed) with hand-verified expected results.

## System prerequisites
None beyond Phase 1.

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C3 Tauri Commands]] (the `compute_unlock` command and `UnlockStatus` type)
- Contract: [[21 Contracts/C1 SQLite Schema]] (node.status values, edge table)
- Architecture: [[20 Architecture#Repository layout]]

## Files
**Create:** `src-tauri/src/commands/unlock.rs`
**Modify:** `src-tauri/src/commands/mod.rs` (add `pub mod unlock;`), `src-tauri/src/main.rs` (register `compute_unlock` in the `generate_handler!`), `src-tauri/Cargo.toml` (add `[[test]]` entry for T-007)

## Steps

1. **Create `src-tauri/src/commands/unlock.rs`** — implement:
   - `compute_unlock(db: State<DbConn>, tree_id: String) -> Result<HashMap<String, UnlockStatus>, AppError>`:
     a. Verify tree exists; return `NotFound` if absent.
     b. Query all nodes for the tree: `SELECT id, status FROM node WHERE tree_id = ?`.
     c. Query all edges for the tree: `SELECT parent_id, child_id FROM edge WHERE tree_id = ?`.
     d. Build a map of `node_id → Vec<child_id>` from edges.
     e. For each node, compute `UnlockStatus`:
        - If `node.status == "completed"` → `"completed"` (passthrough)
        - If `node.status == "in_progress"` → `"in_progress"` (passthrough)
        - If `node.status == "not_started"`:
          - If the node has no children (leaf) → `"unlocked"`
          - If ALL children have `status == "completed"` → `"unlocked"`
          - Otherwise → `"locked"`
     f. Return the map.

2. **Modify `src-tauri/src/commands/mod.rs`** — add `pub mod unlock;`.

3. **Modify `src-tauri/src/main.rs`** — add `arbor_lib::commands::unlock::compute_unlock` to the `generate_handler!` invocation (inside the `#[cfg(feature = "app")]` block).

4. **Add test entry to `src-tauri/Cargo.toml`**:
   ```toml
   [[test]]
   name = "t007-unlock"
   path = "../tests/T-007/unlock.rs"
   ```

## Acceptance criteria
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --test t007-unlock --no-default-features` passes (pre-written at `tests/T-007/unlock.rs`): loads the small fixture tree (`tests/fixtures/small-tree.json`), calls `compute_unlock`, and asserts every node's status matches the hand-verified expected values in the fixture's `_test_notes.expected_unlock_status`.
- [ ] After updating `constraints` to `completed` and recomputing: `dalembert-principle` transitions from `locked` to `locked` (work-and-energy still in_progress), `generalized-coords` transitions from `locked` to `unlocked`.
- [ ] After updating `work-and-energy` to `completed` and recomputing: `dalembert-principle` transitions from `locked` to `unlocked`.
- [ ] `pnpm lint` exits 0

## Out of scope — DO NOT
- Do not cache unlock results in the DB. Unlock is computed live, never stored.
- Do not implement any UI or frontend code.
- Do not modify the fixture file `tests/fixtures/small-tree.json`.
- Do not add any nodes, edges, or trees beyond what the test specifies.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

## Verification
