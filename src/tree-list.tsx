import { useEffect, useState } from 'react';
import type { TreeSummary } from '../contracts/commands';
import { useTreeStore } from './state/tree-store';
import ProgressRing from './progress-ring';
import styles from './tree-list.module.css';

function isTauri(): boolean {
  return (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined;
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
          updated_at: '2026-01-01T00:00:00Z',
        };
        setTrees([mock]);
      }
    }

    void load();
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Your Trees</h1>
      {trees.length === 0 ? (
        <div>
          <p className={styles.empty}>No trees yet.</p>
          {isTauri() && (
            <button
              style={{ margin: '16px auto', display: 'block', padding: '8px 16px', cursor: 'pointer' }}
              onClick={async () => {
                const { seedGraph, updateNodeStatus } = await import('./api/tauri-commands');
                const fixture = await import('../tests/fixtures/large-tree.json');
                const tree = fixture.default as Parameters<typeof seedGraph>[0];
                await seedGraph(tree);
                // Mark first 5 nodes completed, 6th in-progress (demo data)
                const nodes = tree.nodes;
                for (let i = 0; i < 5 && i < nodes.length; i++) {
                  await updateNodeStatus(nodes[i]!.id, 'completed');
                }
                if (nodes.length > 5) {
                  await updateNodeStatus(nodes[5]!.id, 'in_progress');
                }
                // reload trees
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
          {trees.map((tree) => (
            <li
              key={tree.id}
              data-testid="tree-card"
              className={styles.card}
              onClick={() => useTreeStore.getState().selectTree(tree.id)}
            >
              <div className={styles.cardContent}>
                <ProgressRing completed={tree.completed_count} total={tree.node_count} />
                <div className={styles.cardInfo}>
                  <span className={styles.title}>{tree.title}</span>
                  <span className={styles.nodeCount}>{tree.node_count} nodes</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
