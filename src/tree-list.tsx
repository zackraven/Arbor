import { useEffect, useState } from 'react';
import type { TreeSummary } from '../contracts/commands';
import { useTreeStore } from './state/tree-store';
import ProgressRing from './progress-ring';
import styles from './tree-list.module.css';

function isTauri(): boolean {
  return (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

export default function TreeList() {
  const [trees, setTrees] = useState<TreeSummary[]>([]);

  useEffect(() => {
    async function load() {
      if (isTauri()) {
        const { listTrees } = await import('./api/tauri-commands');
        const result = await listTrees();
        setTrees(result);
      } else {
        const fixtureData = (await import('../tests/fixtures/large-tree.json')) as {
          default: { nodes: unknown[] };
        };
        const nodeCount = fixtureData.default.nodes.length;
        const mock: TreeSummary = {
          id: 'classical-to-lagrangian-mechanics',
          title: 'Classical Mechanics → Lagrangian Mechanics',
          node_count: nodeCount,
          completed_count: 5,
          version: 1,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-08-08T00:00:00Z',
        };
        setTrees([mock]);
      }
    }

    void load();
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Your Trees</h1>
      <p className={styles.subtitle}>Select a tree to continue learning</p>
      {trees.length === 0 ? (
        <div>
          <p className={styles.empty}>No trees yet.</p>
          {isTauri() && (
            <button
              className={styles.seedButton}
              onClick={async () => {
                const { seedGraph, updateNodeStatus } = await import('./api/tauri-commands');
                const fixture = await import('../tests/fixtures/large-tree.json');
                const tree = fixture.default as Parameters<typeof seedGraph>[0];
                await seedGraph(tree);
                const nodes = tree.nodes;
                for (let i = 0; i < 5 && i < nodes.length; i++) {
                  await updateNodeStatus(nodes[i]!.id, 'completed');
                }
                if (nodes.length > 5) {
                  await updateNodeStatus(nodes[5]!.id, 'in_progress');
                }
                const { listTrees } = await import('./api/tauri-commands');
                setTrees(await listTrees());
              }}
            >
              Seed demo tree
            </button>
          )}
        </div>
      ) : (
        <ul className={styles.list}>
          {trees.map((tree) => {
            const pct = tree.node_count > 0 ? Math.round((tree.completed_count / tree.node_count) * 100) : 0;
            return (
              <li
                key={tree.id}
                data-testid="tree-card"
                className={styles.card}
                onClick={() => useTreeStore.getState().selectTree(tree.id)}
              >
                <div className={styles.cardContent}>
                  <ProgressRing completed={tree.completed_count} total={tree.node_count} size={56} />
                  <div className={styles.cardInfo}>
                    <span className={styles.title}>{tree.title}</span>
                    <div className={styles.meta}>
                      <span className={styles.nodeCount}>{tree.node_count} nodes</span>
                      <span className={styles.percent}>{pct}% complete</span>
                      <span className={styles.updated}>Updated {formatRelativeDate(tree.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
