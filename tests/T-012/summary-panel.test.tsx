/**
 * T-012 Acceptance tests — Summary panel
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Run: pnpm test
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import SummaryPanel from '../../src/graph/summary-panel';
import { useGraphStore } from '../../src/state/graph-store';
import type { GraphNode, GraphEdge } from '../../contracts/commands';

const testNodes: GraphNode[] = [
  { id: 'n1', title: 'Vector Algebra', one_liner: 'Dot and cross products', category: 'Math', status: 'not_started', pack_path: null },
  { id: 'n2', title: 'Kinematics', one_liner: 'Motion in space', category: 'Mechanics', status: 'completed', pack_path: null },
  { id: 'n3', title: 'Dynamics', one_liner: 'Forces and acceleration', category: 'Mechanics', status: 'not_started', pack_path: null },
];

const testEdges: GraphEdge[] = [
  { id: 1, parent_id: 'n3', child_id: 'n1', justification: 'prereq' },
  { id: 2, parent_id: 'n3', child_id: 'n2', justification: 'prereq' },
];

describe('T-012 Summary panel', () => {
  beforeEach(() => {
    useGraphStore.getState().clear();
  });

  test('renders nothing when no node is selected', () => {
    useGraphStore.getState().setGraph('tree-1', testNodes, testEdges);
    // selectedNodeId is null by default

    const { container } = render(<SummaryPanel />);
    expect(container.innerHTML).toBe('');
  });

  test('renders node details when a node is selected', () => {
    useGraphStore.getState().setGraph('tree-1', testNodes, testEdges);
    useGraphStore.getState().setUnlockStatuses({
      'n1': 'unlocked',
      'n2': 'completed',
      'n3': 'locked',
    });
    useGraphStore.getState().selectNode('n3');

    const { container } = render(<SummaryPanel />);
    const html = container.innerHTML;

    // Should show the selected node's title
    expect(html).toContain('Dynamics');
    // Should show the one-liner
    expect(html).toContain('Forces and acceleration');
  });

  test('shows child nodes for the selected node', () => {
    useGraphStore.getState().setGraph('tree-1', testNodes, testEdges);
    useGraphStore.getState().setUnlockStatuses({
      'n1': 'unlocked',
      'n2': 'completed',
      'n3': 'locked',
    });
    useGraphStore.getState().selectNode('n3');

    const { container } = render(<SummaryPanel />);
    const html = container.innerHTML;

    // n3 has two children: n1 and n2
    expect(html).toContain('Vector Algebra');
    expect(html).toContain('Kinematics');
  });
});
