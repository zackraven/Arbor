/**
 * T-009 Acceptance tests — LayoutEngine adapter
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Run: pnpm test
 */

import { describe, expect, test } from 'vitest';
import { ElkLayoutEngine } from '../../src/graph/layout-engine';
import type { LayoutNode, LayoutEdge, LayoutResult } from '../../src/graph/layout-engine';

describe('T-009 LayoutEngine', () => {
  const engine = new ElkLayoutEngine();

  const nodes: LayoutNode[] = [
    { id: 'a', width: 180, height: 50 },
    { id: 'b', width: 180, height: 50 },
    { id: 'c', width: 180, height: 50 },
    { id: 'd', width: 180, height: 50 },
    { id: 'e', width: 180, height: 50 },
  ];

  // Diamond: a→b, a→c, b→d, c→d, d→e
  const edges: LayoutEdge[] = [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'a', target: 'c' },
    { id: 'e3', source: 'b', target: 'd' },
    { id: 'e4', source: 'c', target: 'd' },
    { id: 'e5', source: 'd', target: 'e' },
  ];

  test('layout returns all nodes with finite coordinates', async () => {
    const result: LayoutResult = await engine.layout(nodes, edges);

    expect(result.nodes).toHaveLength(5);

    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.width).toBe(180);
      expect(node.height).toBe(50);
    }
  });

  test('layout returns all edges', async () => {
    const result: LayoutResult = await engine.layout(nodes, edges);

    expect(result.edges).toHaveLength(5);
    const edgeIds = result.edges.map((e) => e.id);
    expect(edgeIds).toContain('e1');
    expect(edgeIds).toContain('e5');
  });

  test('no two nodes share the same position', async () => {
    const result: LayoutResult = await engine.layout(nodes, edges);

    const positions = new Set<string>();
    for (const node of result.nodes) {
      const key = `${node.x},${node.y}`;
      expect(positions.has(key)).toBe(false);
      positions.add(key);
    }
  });

  test('layout handles empty graph', async () => {
    const result: LayoutResult = await engine.layout([], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  test('layout handles single node', async () => {
    const result: LayoutResult = await engine.layout(
      [{ id: 'solo', width: 180, height: 50 }],
      [],
    );
    expect(result.nodes).toHaveLength(1);
    expect(Number.isFinite(result.nodes[0]!.x)).toBe(true);
    expect(Number.isFinite(result.nodes[0]!.y)).toBe(true);
  });
});
