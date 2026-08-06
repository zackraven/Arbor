/**
 * T-011 Acceptance tests — Node visual states + click interaction
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Run: pnpm test
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import GraphView from '../../src/graph/graph-view';
import { useGraphStore } from '../../src/state/graph-store';

describe('T-011 Visual states', () => {
  beforeEach(() => {
    useGraphStore.getState().clear();
  });

  test('fixture loads with mixed unlock statuses (not all locked)', async () => {
    render(<GraphView />);

    await waitFor(
      () => {
        const statuses = useGraphStore.getState().unlockStatuses;
        expect(Object.keys(statuses).length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const statuses = useGraphStore.getState().unlockStatuses;
    const values = Object.values(statuses);

    // Must have at least one of each visible status
    expect(values).toContain('completed');
    expect(values).toContain('in_progress');
    expect(values).toContain('unlocked');
    expect(values).toContain('locked');
  });

  test('fixture has exactly 5 completed and 1 in_progress status', async () => {
    render(<GraphView />);

    await waitFor(
      () => {
        const statuses = useGraphStore.getState().unlockStatuses;
        expect(Object.keys(statuses).length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );

    const statuses = useGraphStore.getState().unlockStatuses;
    const values = Object.values(statuses);

    const completedCount = values.filter((v) => v === 'completed').length;
    const inProgressCount = values.filter((v) => v === 'in_progress').length;

    expect(completedCount).toBe(5);
    expect(inProgressCount).toBe(1);
  });

  test('selectNode updates selectedNodeId in store', () => {
    useGraphStore.getState().selectNode('test-node');
    expect(useGraphStore.getState().selectedNodeId).toBe('test-node');

    // Toggle off
    useGraphStore.getState().selectNode(null);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });
});
