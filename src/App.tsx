import { useEffect } from 'react';
import GraphView from './graph/graph-view';
import TreeList from './tree-list';
import { useTreeStore } from './state/tree-store';
import styles from './app.module.css';
import './tokens.css';

export default function App() {
  const selectedTreeId = useTreeStore((s) => s.selectedTreeId);
  const selectTree = useTreeStore((s) => s.selectTree);

  useEffect(() => {
    document.title = 'Arbor';
  }, []);

  if (selectedTreeId === null) {
    return (
      <div className={styles.app}>
        <TreeList />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <div className={styles.graphWrapper}>
        <button className={styles.backButton} onClick={() => selectTree(null)}>
          ← Back
        </button>
        <GraphView treeId={selectedTreeId} />
      </div>
    </div>
  );
}
