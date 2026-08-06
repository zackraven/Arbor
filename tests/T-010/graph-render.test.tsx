/**
 * T-010 Acceptance tests — Graph view rendering
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Run: pnpm test
 *
 * These tests verify that the graph view component renders in a non-Tauri
 * environment (happy-dom) using fixture data. They do NOT test visual
 * appearance — that is covered by the pnpm observe screenshot.
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import GraphView from '../../src/graph/graph-view';
import { useGraphStore } from '../../src/state/graph-store';

// happy-dom does not have window.__TAURI_INTERNALS__, so the loader
// will fall back to fixture data automatically.

describe('T-010 Graph render', () => {
  beforeEach(() => {
    useGraphStore.getState().clear();
  });

  test('GraphView renders without throwing', () => {
    expect(() => render(<GraphView />)).not.toThrow();
  });

  test('fixture data loads into graph store in non-Tauri mode', async () => {
    render(<GraphView />);

    await waitFor(
      () => {
        const state = useGraphStore.getState();
        expect(state.nodes.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const state = useGraphStore.getState();
    // The large fixture has ~60 nodes
    expect(state.nodes.length).toBeGreaterThanOrEqual(55);
    expect(state.nodes.length).toBeLessThanOrEqual(65);
    expect(state.edges.length).toBeGreaterThan(0);
  });

  test('graph store has unlock statuses populated after load', async () => {
    render(<GraphView />);

    await waitFor(
      () => {
        const statuses = useGraphStore.getState().unlockStatuses;
        expect(Object.keys(statuses).length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );
  });
});
