/**
 * T-012 Acceptance tests — Tree list
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Run: pnpm test
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import TreeList from '../../src/tree-list';
import { useTreeStore } from '../../src/state/tree-store';

describe('T-012 Tree list', () => {
  beforeEach(() => {
    useTreeStore.getState().selectTree(null);
  });

  test('renders the fixture tree in non-Tauri mode', async () => {
    const { container } = render(<TreeList />);

    await waitFor(
      () => {
        expect(container.innerHTML).toContain('Classical Mechanics');
      },
      { timeout: 3000 },
    );
  });

  test('shows a progress ring with completion data', async () => {
    const { container } = render(<TreeList />);

    await waitFor(
      () => {
        // The progress ring should show completed/total
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
      },
      { timeout: 3000 },
    );
  });

  test('clicking a tree card sets selectedTreeId', async () => {
    const { container } = render(<TreeList />);

    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="tree-card"]')).not.toBeNull();
      },
      { timeout: 3000 },
    );

    const card = container.querySelector('[data-testid="tree-card"]');
    expect(card).not.toBeNull();
    fireEvent.click(card!);

    expect(useTreeStore.getState().selectedTreeId).toBe('classical-to-lagrangian-mechanics');
  });

  test('shows "Your Trees" heading', async () => {
    const { container } = render(<TreeList />);

    await waitFor(
      () => {
        expect(container.innerHTML).toContain('Your Trees');
      },
      { timeout: 3000 },
    );
  });
});
