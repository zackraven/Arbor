import { create } from 'zustand';
import type { GraphNode, GraphEdge, UnlockStatus } from '../../contracts/commands';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  unlockStatuses: Record<string, UnlockStatus>;
  selectedNodeId: string | null;
  treeId: string | null;

  setGraph: (treeId: string, nodes: GraphNode[], edges: GraphEdge[]) => void;
  setUnlockStatuses: (statuses: Record<string, UnlockStatus>) => void;
  selectNode: (id: string | null) => void;
  clear: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  unlockStatuses: {},
  selectedNodeId: null,
  treeId: null,

  setGraph: (treeId, nodes, edges) => set({ treeId, nodes, edges }),
  setUnlockStatuses: (unlockStatuses) => set({ unlockStatuses }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  clear: () => set({ nodes: [], edges: [], unlockStatuses: {}, selectedNodeId: null, treeId: null }),
}));
