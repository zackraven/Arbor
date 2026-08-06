import { useState, useEffect } from 'react';
import type { GraphNode, GraphEdge, UnlockStatus } from '../../contracts/commands';
import { useGraphStore } from '../state/graph-store';

export function useGraphLoader(treeId?: string): { loading: boolean; error: string | null } {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setGraph, setUnlockStatuses } = useGraphStore();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if ((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined) {
          // Tauri mode: load from backend
          const id = treeId ?? '';
          const { getGraph, computeUnlock } = await import('../api/tauri-commands');
          const [graph, statuses] = await Promise.all([getGraph(id), computeUnlock(id)]);
          if (!cancelled) {
            setGraph(graph.tree_id, graph.nodes, graph.edges);
            setUnlockStatuses(statuses);
          }
        } else {
          // Non-Tauri mode: load fixture data
          const fixtureData = (await import('../../tests/fixtures/large-tree.json')) as {
            default: {
              id: string;
              nodes: Array<{
                id: string;
                title: string;
                one_liner: string;
                category: string;
                outcomes: string[];
                status?: string;
              }>;
              edges: Array<{
                parent_id: string;
                child_id: string;
                justification: string;
              }>;
            };
          };

          const fixture = fixtureData.default;

          const nodes: GraphNode[] = fixture.nodes.map((n) => ({
            id: n.id,
            title: n.title,
            one_liner: n.one_liner,
            category: n.category,
            status: (n.status as GraphNode['status']) ?? 'not_started',
            pack_path: null,
          }));

          const edges: GraphEdge[] = fixture.edges.map((e, idx) => ({
            id: idx,
            parent_id: e.parent_id,
            child_id: e.child_id,
            justification: e.justification,
          }));

          const statuses: Record<string, UnlockStatus> = {};
          for (const node of nodes) {
            statuses[node.id] = 'locked';
          }

          if (!cancelled) {
            setGraph(fixture.id, nodes, edges);
            setUnlockStatuses(statuses);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [treeId, setGraph, setUnlockStatuses]);

  return { loading, error };
}
