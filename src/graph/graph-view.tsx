import '@xyflow/react/dist/style.css';
import { useState, useEffect, useMemo } from 'react';
import { ReactFlow } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { useGraphLoader } from './use-graph-loader';
import { useGraphStore } from '../state/graph-store';
import { ElkLayoutEngine } from './layout-engine';
import ArborNode from './arbor-node';
import type { ArborNodeData } from './arbor-node';
import ArborEdge from './arbor-edge';
import type { ArborEdgeData } from './arbor-edge';
import SummaryPanel from './summary-panel';
import { tokens } from '../../contracts/tokens';
import styles from './graph-view.module.css';

const nodeTypes = { arbor: ArborNode };
const edgeTypes = { arbor: ArborEdge };

const layoutEngine = new ElkLayoutEngine();

/** Cached layout result — positions and layer fractions. Survives re-renders. */
interface LayoutCache {
  positions: Map<string, { x: number; y: number }>;
  layerFractions: Map<string, number>;
}

export default function GraphView({ treeId }: { treeId?: string }) {
  const { loading } = useGraphLoader(treeId);
  const { nodes: graphNodes, edges: graphEdges, unlockStatuses, selectedNodeId, selectNode } = useGraphStore();

  const [layoutCache, setLayoutCache] = useState<LayoutCache | null>(null);

  // Phase 1: ELK layout — runs only when graph structure changes (NOT on selection)
  useEffect(() => {
    if (graphNodes.length === 0) return;

    const layoutNodes = graphNodes.map((n) => ({
      id: n.id,
      width: tokens.node.elkWidth,
      height: tokens.node.elkHeight,
    }));

    const layoutEdges = graphEdges.map((e) => ({
      id: String(e.id),
      source: e.parent_id,
      target: e.child_id,
    }));

    layoutEngine
      .layout(layoutNodes, layoutEdges)
      .then((result) => {
        const positions = new Map(result.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

        const yValues = result.nodes.map((n) => n.y);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const yRange = maxY - minY || 1;

        const layerFractions = new Map(
          result.nodes.map((n) => [n.id, (maxY - n.y) / yRange]),
        );

        setLayoutCache({ positions, layerFractions });
      })
      .catch(() => {
        // layout failed
      });
  }, [graphNodes, graphEdges]);

  // Phase 2: Build flow nodes — depends on layout + statuses (NOT selection)
  const flowNodes = useMemo<Node<ArborNodeData>[]>(() => {
    if (!layoutCache) return [];
    return graphNodes.map((n) => ({
      id: n.id,
      type: 'arbor' as const,
      position: layoutCache.positions.get(n.id) ?? { x: 0, y: 0 },
      data: {
        label: n.title,
        oneLiner: n.one_liner,
        status: unlockStatuses[n.id] ?? 'locked',
      },
    }));
  }, [graphNodes, unlockStatuses, layoutCache]);

  // Phase 3: Build flow edges — depends on layout + statuses + selection (cheap, no ELK)
  const flowEdges = useMemo<Edge[]>(() => {
    if (!layoutCache) return [];
    return graphEdges.map((e) => {
      const sourceLayerFrac = layoutCache.layerFractions.get(e.parent_id) ?? 0.5;
      const targetLayerFrac = layoutCache.layerFractions.get(e.child_id) ?? 0.5;
      const layerFraction = (sourceLayerFrac + targetLayerFrac) / 2;

      const sourceStatus = unlockStatuses[e.parent_id] ?? 'locked';
      const targetStatus = unlockStatuses[e.child_id] ?? 'locked';

      const isHighlighted = selectedNodeId !== null &&
        (e.parent_id === selectedNodeId || e.child_id === selectedNodeId);

      let edgeColor: string = tokens.graph.edgeColor;
      if (isHighlighted) {
        edgeColor = tokens.color.edgeHighlight;
      } else if (sourceStatus === 'completed') {
        edgeColor = tokens.color.edgeCompleted;
      }

      let opacity: number;
      if (isHighlighted) {
        opacity = 1;
      } else if (sourceStatus === 'completed' && targetStatus === 'completed') {
        opacity = tokens.graph.edgeOpacityCompleted;
      } else if (sourceStatus === 'locked' || targetStatus === 'locked') {
        opacity = tokens.graph.edgeOpacityLocked;
      } else {
        opacity = tokens.graph.edgeOpacityDefault;
      }

      const data: ArborEdgeData = {
        layerFraction,
        edgeColor,
        opacity,
        highlighted: isHighlighted,
      };

      return {
        id: String(e.id),
        source: e.parent_id,
        target: e.child_id,
        type: 'arbor' as const,
        zIndex: isHighlighted ? 10 : sourceStatus === 'completed' ? 5 : 0,
        data,
      };
    });
  }, [graphEdges, unlockStatuses, selectedNodeId, layoutCache]);

  if (loading && flowNodes.length === 0) {
    return (
      <div className={styles.container}>
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        defaultEdgeOptions={{ markerEnd: undefined }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_event, node) => selectNode(node.id === selectedNodeId ? null : node.id)}
        onPaneClick={() => selectNode(null)}
      />
      <SummaryPanel />
    </div>
  );
}
