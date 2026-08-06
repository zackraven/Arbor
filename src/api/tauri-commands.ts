import { invoke } from '@tauri-apps/api/core';
import type {
  TreeSummary,
  Tree,
  Graph,
  NodeDetail,
  UnlockStatus,
  GraphLogEntry,
  SeedTree,
} from '../../contracts/commands';

export function listTrees(): Promise<TreeSummary[]> {
  return invoke('list_trees');
}

export function getTree(treeId: string): Promise<Tree> {
  return invoke('get_tree', { treeId });
}

export function getGraph(treeId: string): Promise<Graph> {
  return invoke('get_graph', { treeId });
}

export function getNode(nodeId: string): Promise<NodeDetail> {
  return invoke('get_node', { nodeId });
}

export function computeUnlock(treeId: string): Promise<Record<string, UnlockStatus>> {
  return invoke('compute_unlock', { treeId });
}

export function getGraphLog(treeId: string, limit?: number): Promise<GraphLogEntry[]> {
  return invoke('get_graph_log', { treeId, limit });
}

export function seedGraph(tree: SeedTree): Promise<void> {
  return invoke('seed_graph', { tree });
}

export function updateNodeStatus(
  nodeId: string,
  status: 'not_started' | 'in_progress' | 'completed',
): Promise<void> {
  return invoke('update_node_status', { nodeId, status });
}
