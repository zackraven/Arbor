/**
 * T-009 Acceptance tests — Graph store (zustand)
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Run: pnpm test
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { useGraphStore } from '../../src/state/graph-store';
import type { GraphNode, GraphEdge } from '../../contracts/commands';

describe('T-009 GraphStore', () => {
  beforeEach(() => {
    useGraphStore.getState().clear();
  });

  test('initial state has empty arrays and null selections', () => {
    const state = useGraphStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.unlockStatuses).toEqual({});
    expect(state.selectedNodeId).toBeNull();
    expect(state.treeId).toBeNull();
  });

  test('setGraph populates treeId, nodes, and edges', () => {
    const nodes: GraphNode[] = [
      { id: 'n1', title: 'Node 1', one_liner: 'First', category: 'math', status: 'not_started', pack_path: null },
      { id: 'n2', title: 'Node 2', one_liner: 'Second', category: 'math', status: 'completed', pack_path: null },
    ];
    const edges: GraphEdge[] = [
      { id: 1, parent_id: 'n1', child_id: 'n2', justification: 'prereq' },
    ];

    useGraphStore.getState().setGraph('tree-1', nodes, edges);

    const state = useGraphStore.getState();
    expect(state.treeId).toBe('tree-1');
    expect(state.nodes).toHaveLength(2);
    expect(state.edges).toHaveLength(1);
  });

  test('setUnlockStatuses updates the unlock map', () => {
    useGraphStore.getState().setUnlockStatuses({
      'n1': 'unlocked',
      'n2': 'locked',
      'n3': 'completed',
    });

    const statuses = useGraphStore.getState().unlockStatuses;
    expect(statuses['n1']).toBe('unlocked');
    expect(statuses['n2']).toBe('locked');
    expect(statuses['n3']).toBe('completed');
  });

  test('selectNode updates selectedNodeId', () => {
    useGraphStore.getState().selectNode('n1');
    expect(useGraphStore.getState().selectedNodeId).toBe('n1');

    useGraphStore.getState().selectNode('n2');
    expect(useGraphStore.getState().selectedNodeId).toBe('n2');

    useGraphStore.getState().selectNode(null);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });

  test('clear resets all state', () => {
    const nodes: GraphNode[] = [
      { id: 'n1', title: 'Node 1', one_liner: 'First', category: 'math', status: 'not_started', pack_path: null },
    ];

    useGraphStore.getState().setGraph('tree-1', nodes, []);
    useGraphStore.getState().selectNode('n1');
    useGraphStore.getState().setUnlockStatuses({ 'n1': 'unlocked' });

    useGraphStore.getState().clear();

    const state = useGraphStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.unlockStatuses).toEqual({});
    expect(state.selectedNodeId).toBeNull();
    expect(state.treeId).toBeNull();
  });
});
