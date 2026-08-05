---
tags: [spec, implementation, contracts, C3]
freeze: firm
mirrors:
  - contracts/commands.d.ts
---

# C3 — Tauri Commands

> **Freeze level: FIRM.** Extends per phase (new commands added, existing signatures stable). Changes to existing command signatures require an architect session + a dated entry in [[12 Open Questions & Decisions Log]]. New commands may be added by an architect without a decisions-log entry.

## Purpose

Defines every Tauri command the frontend may invoke. Each command specifies its name, parameters, return type, and error codes. The frontend calls these via `@tauri-apps/api/core`'s `invoke()`. The backend implements them as `#[tauri::command]` functions in Rust.

## Error contract

Every command returns `Result<T, AppError>`. `AppError` serialises to JSON:

```typescript
interface AppError {
  code: string;       // enumerated per command below
  message: string;    // human-readable, for dev/debug
  detail?: string;    // optional structured detail
}
```

Error codes are namespaced: `{domain}.{specific}` (e.g. `db.not_found`, `graph.cycle_detected`). The frontend renders unexpected codes as raw strings — no invented copy.

## Phase 2 commands

### Trees

```typescript
/** List all trees. Returns empty array if none exist. */
invoke('list_trees'): Promise<TreeSummary[]>

interface TreeSummary {
  id: string;
  title: string;
  node_count: number;    // computed: COUNT of nodes in this tree
  completed_count: number; // computed: COUNT of nodes with status='completed'
  version: number;
  created_at: string;    // ISO 8601 UTC
  updated_at: string;
}

/** Get a single tree by id. */
invoke('get_tree', { treeId: string }): Promise<Tree>

interface Tree {
  id: string;
  title: string;
  scope: { top_bubble: string; categories: string[] };
  version: number;
  created_at: string;
  updated_at: string;
}
// Errors: db.not_found
```

### Graph

```typescript
/** Fetch the full graph for a tree: all nodes + all edges.
 *  Used by the graph view to render the DAG. */
invoke('get_graph', { treeId: string }): Promise<Graph>

interface Graph {
  tree_id: string;
  tree_version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;
  title: string;
  one_liner: string;
  category: string;
  status: 'not_started' | 'in_progress' | 'completed';
  pack_path: string | null;
}

interface GraphEdge {
  id: number;
  parent_id: string;
  child_id: string;
  justification: string;
}
// Errors: db.not_found
```

### Unlock computation

```typescript
/** Compute unlock status for all nodes in a tree.
 *  Returns a map of node_id → unlock status.
 *  Unlock is never stored — always computed live from edges + node status. */
invoke('compute_unlock', { treeId: string }): Promise<Record<string, UnlockStatus>>

type UnlockStatus = 'locked' | 'unlocked' | 'in_progress' | 'completed';
// 'completed' and 'in_progress' are passed through from node.status.
// 'unlocked' = all children completed AND node.status == 'not_started'.
// 'locked' = at least one child not completed AND node.status == 'not_started'.
// Leaf nodes (no children) with status 'not_started' are 'unlocked'.
```

Errors: `db.not_found`

### Graph log

```typescript
/** Fetch the mutation log for a tree, newest first. */
invoke('get_graph_log', { treeId: string, limit?: number }): Promise<GraphLogEntry[]>

interface GraphLogEntry {
  id: number;
  tree_version: number;
  change_type: 'node_added' | 'node_removed' | 'edge_added' | 'edge_removed' | 'node_updated';
  entity_id: string;
  payload: Record<string, unknown>;  // deserialized from payload_json
  actor: 'build_pipeline' | 'repair' | 'user';
  created_at: string;
}
// Errors: db.not_found
```

### Node detail

```typescript
/** Get full node record including outcomes and provenance. */
invoke('get_node', { nodeId: string }): Promise<NodeDetail>

interface NodeDetail {
  id: string;
  tree_id: string;
  title: string;
  one_liner: string;
  category: string;
  outcomes: string[];           // deserialized from outcomes_json
  status: 'not_started' | 'in_progress' | 'completed';
  pack_path: string | null;
  provenance: Record<string, unknown>;  // deserialized from provenance_json
  created_at: string;
  updated_at: string;
}
// Errors: db.not_found
```

### Fixture / seed commands (Phase 2 testing only)

```typescript
/** Insert a tree + its nodes + edges in a single transaction.
 *  Used by fixture loading in tests and the future build pipeline.
 *  Validates: no duplicate node ids, no self-loops, no cycles, all edge
 *  endpoints exist. Bumps tree version and writes graph_log entries. */
invoke('seed_graph', { tree: SeedTree }): Promise<void>

interface SeedTree {
  id: string;
  title: string;
  scope: { top_bubble: string; categories: string[] };
  nodes: SeedNode[];
  edges: SeedEdge[];
}

interface SeedNode {
  id: string;
  title: string;
  one_liner: string;
  category: string;
  outcomes: string[];
  status?: 'not_started' | 'in_progress' | 'completed';  // default: not_started
}

interface SeedEdge {
  parent_id: string;
  child_id: string;
  justification: string;
}
// Errors: db.not_found, graph.duplicate_node, graph.self_loop,
//         graph.cycle_detected, graph.dangling_edge
```

```typescript
/** Update a single node's status. Used by tests to simulate learner progress.
 *  Bumps tree version and writes a graph_log entry. */
invoke('update_node_status', {
  nodeId: string,
  status: 'not_started' | 'in_progress' | 'completed'
}): Promise<void>
// Errors: db.not_found, graph.invalid_status_transition
```

## Invariants

1. **All commands that read from the DB set pragmas first** — `PRAGMA foreign_keys = ON` is applied per connection via `db::open_or_init`. No command may bypass this.
2. **Graph mutations bump `tree.version`** — `seed_graph` and `update_node_status` atomically increment `tree.version` and append to `graph_log`.
3. **`compute_unlock` is pure computation** — it reads `node.status` and `edge` rows, computes the result, and returns it. It writes nothing. The result is never cached in the DB.
4. **Cycle detection in `seed_graph`** — the command must verify the edge set is acyclic before committing. A cycle produces `graph.cycle_detected` and the entire transaction is rolled back.
5. **Error codes are stable per command** — adding a new error code to an existing command requires an architect session. Error messages are unstable (may change freely).

## Changelog

| Date       | Change                              | Decisions-log ref                          |
|------------|-------------------------------------|--------------------------------------------|
| 2026-08-05 | Initial Phase 2 command set         | [[12 Open Questions & Decisions Log#phase1-boundary-2026-08-05]] |
