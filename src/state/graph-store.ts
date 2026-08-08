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

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  unlockStatuses: Record<string, UnlockStatus>;
  selectedNodeId: string | null;
  /** Set of node IDs in the transitive focus chain. Null when no selection. */
  focusSet: Set<string> | null;
  treeId: string | null;

  setGraph: (treeId: string, nodes: GraphNode[], edges: GraphEdge[]) => void;
  setUnlockStatuses: (statuses: Record<string, UnlockStatus>) => void;
  selectNode: (id: string | null) => void;
  clear: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  unlockStatuses: {},
  selectedNodeId: null,
  focusSet: null,
  treeId: null,

  setGraph: (treeId, nodes, edges) => set({ treeId, nodes, edges }),
  setUnlockStatuses: (unlockStatuses) => set({ unlockStatuses }),
  selectNode: (selectedNodeId) => {
    if (selectedNodeId === null) {
      set({ selectedNodeId: null, focusSet: null });
    } else {
      const { edges } = get();
      const focusSet = computeFocusSet(selectedNodeId, edges);
      set({ selectedNodeId, focusSet });
    }
  },
  clear: () => set({ nodes: [], edges: [], unlockStatuses: {}, selectedNodeId: null, focusSet: null, treeId: null }),
}));
