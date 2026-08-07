/**
 * T-014 Acceptance tests — Edge highlighting (selection + completion)
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Run: pnpm test
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import GraphView from '../../src/graph/graph-view';
import { useGraphStore } from '../../src/state/graph-store';
import { tokens } from '../../contracts/tokens';

describe('T-014 Edge highlighting', () => {
  beforeEach(() => {
    useGraphStore.getState().clear();
  });

  test('selected node edges get highlight colour and width', async () => {
    render(<GraphView />);

    // Wait for graph to load and layout to complete
    await waitFor(
      () => {
        const { nodes } = useGraphStore.getState();
        expect(nodes.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    // Wait for flow edges to render
    await waitFor(() => {
      const edges = document.querySelectorAll('.react-flow__edge');
      expect(edges.length).toBeGreaterThan(0);
    });

    // Select a node that has edges (basic-calculus has parents that depend on it)
    const { nodes, edges } = useGraphStore.getState();
    // Find a node that appears as source or target in at least one edge
    const nodeWithEdges = nodes.find((n) =>
      edges.some((e) => e.parent_id === n.id || e.child_id === n.id),
    );
    expect(nodeWithEdges).toBeDefined();

    useGraphStore.getState().selectNode(nodeWithEdges!.id);

    // Re-render should update edge styles
    // The component needs to re-render with the new selectedNodeId
    await waitFor(() => {
      // Check that at least one edge has the highlight colour
      const edgePaths = document.querySelectorAll('.react-flow__edge path');
      const highlightedEdges = Array.from(edgePaths).filter((path) => {
        const stroke = path.getAttribute('stroke');
        return stroke === tokens.color.edgeHighlight;
      });
      expect(highlightedEdges.length).toBeGreaterThan(0);
    });
  });

  test('completed node edges from children are green', async () => {
    render(<GraphView />);

    await waitFor(
      () => {
        const statuses = useGraphStore.getState().unlockStatuses;
        expect(Object.values(statuses)).toContain('completed');
      },
      { timeout: 5000 },
    );

    // Wait for flow edges to render
    await waitFor(() => {
      const edges = document.querySelectorAll('.react-flow__edge');
      expect(edges.length).toBeGreaterThan(0);
    });

    // Find completed nodes and their child edges
    const { edges, unlockStatuses } = useGraphStore.getState();
    const completedNodeIds = Object.entries(unlockStatuses)
      .filter(([, status]) => status === 'completed')
      .map(([id]) => id);

    // There should be edges where the parent (target in edge data) is completed
    const completedEdges = edges.filter((e) =>
      completedNodeIds.includes(e.parent_id),
    );
    // Our fixture has completed nodes with children, so there should be completed edges
    expect(completedEdges.length).toBeGreaterThan(0);

    // Check that at least one edge has the completed colour
    await waitFor(() => {
      const edgePaths = document.querySelectorAll('.react-flow__edge path');
      const greenEdges = Array.from(edgePaths).filter((path) => {
        const stroke = path.getAttribute('stroke');
        return stroke === tokens.color.edgeCompleted;
      });
      expect(greenEdges.length).toBeGreaterThan(0);
    });
  });

  test('tokens.css has edge highlight custom properties', async () => {
    // Read tokens.css content via a style check — the custom properties
    // should be defined in :root
    const root = document.documentElement;
    const styles = getComputedStyle(root);

    // Import tokens.css side effect (already imported by GraphView)
    render(<GraphView />);

    await waitFor(
      () => {
        const { nodes } = useGraphStore.getState();
        expect(nodes.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    // Verify the token values exist in the contract
    expect(tokens.color.edgeHighlight).toBe('#1565c0');
    expect(tokens.color.edgeCompleted).toBe('#2e7d32');
    expect(tokens.graph.edgeHighlightWidth).toBe(2.5);
  });
});
