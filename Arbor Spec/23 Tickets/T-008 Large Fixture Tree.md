---
id: T-008
phase: 2
status: done
depends_on: [T-006]
---

# T-008 — Large fixture tree validation (60-node, classical → Lagrangian mechanics)

## Goal
The architect-authored 60-node fixture tree at `tests/fixtures/large-tree.json` loads via `seed_graph` without error and passes all shape-constraint tests. The fixture content is written by the architect and reviewed by the user for physics sanity before this ticket runs.

## System prerequisites
None beyond Phase 1.

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C3 Tauri Commands]] (the `SeedTree` type and `seed_graph` command)
- Contract: [[21 Contracts/C1 SQLite Schema]] (node table columns)

## Files
**Create:** none — `tests/fixtures/large-tree.json` is ALREADY WRITTEN by the architect and reviewed by the user. Do not create, modify, or regenerate it.
**Modify:** `src-tauri/Cargo.toml` (add `[[test]]` entry for T-008)

## Steps

1. **Add test entry to `src-tauri/Cargo.toml`**:
   ```toml
   [[test]]
   name = "t008-large-fixture"
   path = "../tests/T-008/large_fixture.rs"
   ```

2. **Run tests** — `cargo test --manifest-path src-tauri/Cargo.toml --test t008-large-fixture --no-default-features`. The test file is pre-written. It loads `tests/fixtures/large-tree.json`, seeds it via `seed_graph_impl`, and verifies all shape constraints. If any test fails → Blocked (the fixture content is the architect's responsibility, not the implementer's).

3. **Run lint** — `pnpm lint` must exit 0.

## Acceptance criteria
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --test t008-large-fixture --no-default-features` passes (pre-written at `tests/T-008/large_fixture.rs`): loads the fixture via `seed_graph`, verifies shape constraints (node count 55–65, ≥3 diamond merges, ≥1 node with 4+ parents, branch depth variance ≥3, ≥1 chain of ≥6 edges, ≥1 node with ≥5 children, ≥4 categories, all statuses `not_started`), verifies no cycles.
- [ ] `pnpm lint` exits 0

## Out of scope — DO NOT
- Do not create or modify `tests/fixtures/large-tree.json`. It is architect-authored and user-reviewed. If the fixture is missing or malformed → Blocked.
- Do not modify the small fixture (`tests/fixtures/small-tree.json`).
- Do not add any Tauri commands or frontend code.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Human checkpoint
Before this ticket is dispatched to an implementer, the user must confirm they have reviewed `tests/fixtures/large-tree.json` for physics sanity (the shape tests can pass on structurally valid nonsense). The architect generates the fixture; the user eyeballs it; then the ticket runs.

## Blocked

## Implementation notes

Added a single `[[test]]` entry to `/c/Users/Alex/Documents/Projects/Arbor/src-tauri/Cargo.toml`:

```toml
[[test]]
name = "t008-large-fixture"
path = "../tests/T-008/large_fixture.rs"
```

All 9 acceptance tests passed:
- `large_fixture_loads` — seed_graph succeeded on the fixture (no cycles, no duplicates)
- `node_count_in_range` — node count is within 55–65
- `at_least_3_diamond_merges` — 3+ nodes with 2+ parents
- `high_fan_in_node_exists` — at least one node with 4+ parents
- `branch_depth_variance` — max_depth − min_depth ≥ 3
- `deep_chain_exists` — longest chain has 7+ nodes (6+ edges)
- `wide_fan_out_exists` — at least one node with 5+ children
- `at_least_4_categories` — 4+ distinct categories
- `all_nodes_not_started` — all node statuses are `not_started`

`pnpm lint` (tsc + cargo clippy -D warnings) exited 0.

No nits; no additional abstractions were added beyond what the ticket specified.

## Verification

Verification: pass — 2026-08-05
- tests/T-008/large_fixture.rs (9 tests): passed — large_fixture_loads, node_count_in_range, at_least_3_diamond_merges, high_fan_in_node_exists, branch_depth_variance, deep_chain_exists, wide_fan_out_exists, at_least_4_categories, all_nodes_not_started
- pnpm lint (tsc --noEmit + cargo clippy -D warnings): exits 0
- Diff check: only a single [[test]] entry added to src-tauri/Cargo.toml; tests/fixtures/large-tree.json not touched; no other files modified
- Out-of-scope: no violations
- Files: only src-tauri/Cargo.toml modified as specified
