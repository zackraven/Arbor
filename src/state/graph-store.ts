import { create } from 'zustand';
import type { GraphNode, GraphEdge, UnlockStatus } from '../../contracts/commands';

/** Compute the transitive focus set for a selected node.
 *  Returns all ancestors (prerequisites downward) and descendants (dependents upward)
 *  plus the selected node itself. */
function computeFocusSet(
  nodeId: string,
  edges: GraphEdge[],
): Set<string> {
  // Build adjacency maps once
  const childrenOf = new Map<string, string[]>(); // parent → children
  const parentsOf = new Map<string, string[]>();   // child → parents
  for (const e of edges) {
    let c = childrenOf.get(e.parent_id);
    if (!c) { c = []; childrenOf.set(e.parent_id, c); }
    c.push(e.child_id);

    let p = parentsOf.get(e.child_id);
    if (!p) { p = []; parentsOf.set(e.child_id, p); }
    p.push(e.parent_id);
  }

  const focus = new Set<string>();
  focus.add(nodeId);

  // BFS downward — all transitive prerequisites (children in edge direction)
  const downQueue = [nodeId];
  while (downQueue.length > 0) {
    const cur = downQueue.pop()!;
    for (const child of childrenOf.get(cur) ?? []) {
      if (!focus.has(child)) {
        focus.add(child);
        downQueue.push(child);
      }
    }
  }

  // BFS upward — all transitive dependents (parents in edge direction)
  const upQueue = [nodeId];
  while (upQueue.length > 0) {
    const cur = upQueue.pop()!;
    for (const parent of parentsOf.get(cur) ?? []) {
      if (!focus.has(parent)) {
        focus.add(parent);
        upQueue.push(parent);
      }
    }
  }

  return focus;
}

/** Compute the shortest path from any root to the target node.
 *  Returns the set of node IDs on that path. */
function computeCriticalPath(
  targetId: string,
  edges: GraphEdge[],
): Set<string> {
  // Build parent map: child → parents
  const parentsOf = new Map<string, string[]>();
  for (const e of edges) {
    let p = parentsOf.get(e.child_id);
    if (!p) { p = []; parentsOf.set(e.child_id, p); }
    p.push(e.parent_id);
  }

  // BFS upward from target, recording path via predecessor map
  const pred = new Map<string, string | null>();
  pred.set(targetId, null);
  const queue = [targetId];
  let rootFound: string | null = null;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const parents = parentsOf.get(cur) ?? [];
    if (parents.length === 0) {
      // This is a root node
      rootFound = cur;
      break;
    }
    for (const parent of parents) {
      if (!pred.has(parent)) {
        pred.set(parent, cur);
        queue.push(parent);
      }
    }
  }

  const path = new Set<string>();
  if (rootFound !== null) {
    let cur: string | null = rootFound;
    while (cur !== null) {
      path.add(cur);
      cur = pred.get(cur) ?? null;
      if (cur !== null && path.has(cur)) break; // safety
    }
  }
  // Always include the target
  path.add(targetId);
  return path;
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  unlockStatuses: Record<string, UnlockStatus>;
  selectedNodeId: string | null;
  /** Set of node IDs in the transitive focus chain. Null when no selection. */
  focusSet: Set<string> | null;
  /** Set of node IDs on the critical path from root to selected node. Null when no selection. */
  criticalPath: Set<string> | null;
  treeId: string | null;

  setGraph: (treeId: string, nodes: GraphNode[], edges: GraphEdge[]) => void;
  setUnlockStatuses: (statuses: Record<string, UnlockStatus>) => void;
  selectNode: (id: string | null) => void;
  /** Navigate to a parent (up the tree toward dependents) */
  navigateUp: () => void;
  /** Navigate to a child (down the tree toward prerequisites) */
  navigateDown: () => void;
  /** Navigate to left sibling (same parent) */
  navigateLeft: () => void;
  /** Navigate to right sibling (same parent) */
  navigateRight: () => void;
  clear: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  unlockStatuses: {},
  selectedNodeId: null,
  focusSet: null,
  criticalPath: null,
  treeId: null,

  setGraph: (treeId, nodes, edges) => set({ treeId, nodes, edges }),
  setUnlockStatuses: (unlockStatuses) => set({ unlockStatuses }),
  selectNode: (selectedNodeId) => {
    if (selectedNodeId === null) {
      set({ selectedNodeId: null, focusSet: null, criticalPath: null });
    } else {
      const { edges } = get();
      const focusSet = computeFocusSet(selectedNodeId, edges);
      const criticalPath = computeCriticalPath(selectedNodeId, edges);
      set({ selectedNodeId, focusSet, criticalPath });
    }
  },

  navigateUp: () => {
    const { selectedNodeId, edges } = get();
    if (!selectedNodeId) return;
    const parents = edges.filter((e) => e.child_id === selectedNodeId).map((e) => e.parent_id);
    if (parents.length > 0) {
      const id = parents[0]!;
      const focusSet = computeFocusSet(id, edges);
      const criticalPath = computeCriticalPath(id, edges);
      set({ selectedNodeId: id, focusSet, criticalPath });
    }
  },

  navigateDown: () => {
    const { selectedNodeId, edges } = get();
    if (!selectedNodeId) return;
    const children = edges.filter((e) => e.parent_id === selectedNodeId).map((e) => e.child_id);
    if (children.length > 0) {
      const id = children[0]!;
      const focusSet = computeFocusSet(id, edges);
      const criticalPath = computeCriticalPath(id, edges);
      set({ selectedNodeId: id, focusSet, criticalPath });
    }
  },

  navigateLeft: () => {
    const { selectedNodeId, edges } = get();
    if (!selectedNodeId) return;
    const parents = edges.filter((e) => e.child_id === selectedNodeId).map((e) => e.parent_id);
    if (parents.length === 0) return;
    const siblings = edges.filter((e) => parents.includes(e.parent_id)).map((e) => e.child_id);
    const unique = [...new Set(siblings)];
    const idx = unique.indexOf(selectedNodeId);
    const prev = unique[(idx - 1 + unique.length) % unique.length]!;
    if (prev !== selectedNodeId) {
      const focusSet = computeFocusSet(prev, edges);
      const criticalPath = computeCriticalPath(prev, edges);
      set({ selectedNodeId: prev, focusSet, criticalPath });
    }
  },

  navigateRight: () => {
    const { selectedNodeId, edges } = get();
    if (!selectedNodeId) return;
    const parents = edges.filter((e) => e.child_id === selectedNodeId).map((e) => e.parent_id);
    if (parents.length === 0) return;
    const siblings = edges.filter((e) => parents.includes(e.parent_id)).map((e) => e.child_id);
    const unique = [...new Set(siblings)];
    const idx = unique.indexOf(selectedNodeId);
    const next = unique[(idx + 1) % unique.length]!;
    if (next !== selectedNodeId) {
      const focusSet = computeFocusSet(next, edges);
      const criticalPath = computeCriticalPath(next, edges);
      set({ selectedNodeId: next, focusSet, criticalPath });
    }
  },

  clear: () => set({ nodes: [], edges: [], unlockStatuses: {}, selectedNodeId: null, focusSet: null, criticalPath: null, treeId: null }),
}));
