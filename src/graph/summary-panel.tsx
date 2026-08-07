import { useEffect, useState } from 'react';
import { useGraphStore } from '../state/graph-store';
import styles from './summary-panel.module.css';

function isTauri(): boolean {
  return (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined;
}

export default function SummaryPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const unlockStatuses = useGraphStore((s) => s.unlockStatuses);
  const selectNode = useGraphStore((s) => s.selectNode);

  const [outcomes, setOutcomes] = useState<string[]>([]);

  // Look up selected node synchronously from the graph store
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  useEffect(() => {
    if (selectedNodeId === null) {
      setOutcomes([]);
      return;
    }

    async function loadOutcomes() {
      if (isTauri()) {
        const { getNode } = await import('../api/tauri-commands');
        const detail = await getNode(selectedNodeId!);
        setOutcomes(detail.outcomes);
      } else {
        const fixtureData = (await import('../../tests/fixtures/large-tree.json')) as {
          default: {
            nodes: Array<{
              id: string;
              outcomes: string[];
            }>;
          };
        };
        const fixtureNode = fixtureData.default.nodes.find((n) => n.id === selectedNodeId);
        setOutcomes(fixtureNode?.outcomes ?? []);
      }
    }

    void loadOutcomes();
  }, [selectedNodeId]);

  if (selectedNodeId === null || selectedNode === null) {
    return null;
  }

  const childEdges = edges.filter((e) => e.parent_id === selectedNodeId);
  const childNodes = childEdges.map((e) => nodes.find((n) => n.id === e.child_id)).filter(Boolean);
  const unlockStatus = unlockStatuses[selectedNodeId] ?? 'locked';

  return (
    <div className={styles.panel}>
      <button className={styles.closeButton} onClick={() => selectNode(null)}>
        ×
      </button>
      <h2 className={styles.title}>{selectedNode.title}</h2>
      <p className={styles.oneLiner}>{selectedNode.one_liner}</p>
      <div className={styles.meta}>
        <span className={styles.category}>{selectedNode.category}</span>
        <span className={`${styles.badge} ${styles[`badge-${unlockStatus}`] ?? ''}`}>
          {unlockStatus}
        </span>
      </div>
      {outcomes.length > 0 && (
        <div className={styles.outcomes}>
          <h3 className={styles.sectionHeading}>Outcomes</h3>
          <ul className={styles.outcomeList}>
            {outcomes.map((outcome, i) => (
              <li key={i} className={styles.outcomeItem}>
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      )}
      {childNodes.length > 0 && (
        <div className={styles.children}>
          <h3 className={styles.sectionHeading}>Prerequisites</h3>
          <ul className={styles.childList}>
            {childNodes.map((child) => {
              if (!child) return null;
              const childStatus = unlockStatuses[child.id] ?? 'locked';
              return (
                <li key={child.id} className={styles.childItem}>
                  <span className={styles.childTitle}>{child.title}</span>
                  <span className={`${styles.badge} ${styles[`badge-${childStatus}`] ?? ''}`}>
                    {childStatus}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
