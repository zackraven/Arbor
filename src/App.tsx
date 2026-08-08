import { useEffect, useState, useCallback } from 'react';
import GraphView from './graph/graph-view';
import TreeList from './tree-list';
import { useTreeStore } from './state/tree-store';
import styles from './app.module.css';
import './tokens.css';

type ThemeSetting = 'light' | 'dark' | 'system';

function getInitialTheme(): ThemeSetting {
  return (localStorage.getItem('arbor-theme') as ThemeSetting) ?? 'dark';
}

function applyTheme(theme: ThemeSetting, animate = true) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transitioning');
  }
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  localStorage.setItem('arbor-theme', theme);
  if (animate) {
    setTimeout(() => root.classList.remove('theme-transitioning'), 450);
  }
}

export default function App() {
  const selectedTreeId = useTreeStore((s) => s.selectedTreeId);
  const selectTree = useTreeStore((s) => s.selectTree);
  const [theme, setTheme] = useState<ThemeSetting>(getInitialTheme);

  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      applyTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.title = 'Arbor';
    applyTheme(theme, false);
  }, []);

  const themeIcon = theme === 'dark' ? '☽' : theme === 'light' ? '☀' : '◐';
  const themeLabel = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System';

  if (selectedTreeId === null) {
    return (
      <div className={styles.app}>
        <button className={styles.themeToggle} onClick={cycleTheme} title={`Theme: ${themeLabel}`}>
          {themeIcon}
        </button>
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
        <button className={styles.themeToggle} onClick={cycleTheme} title={`Theme: ${themeLabel}`}>
          {themeIcon}
        </button>
        <GraphView treeId={selectedTreeId} />
      </div>
    </div>
  );
}
