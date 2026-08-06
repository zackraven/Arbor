import { useEffect } from 'react';
import GraphView from './graph/graph-view';
import './tokens.css';

export default function App() {
  useEffect(() => {
    document.title = 'Arbor';
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GraphView />
    </div>
  );
}
