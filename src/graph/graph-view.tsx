import '@xyflow/react/dist/style.css';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, useReactFlow } from '@xyflow/react';
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

/** Padding (px) around the node bounding box for translateExtent. */
const EXTENT_PADDING = 200;

/** Cached layout result — positions and layer fractions. Survives re-renders. */
interface LayoutCache {
  positions: Map<string, { x: number; y: number }>;
  layerFractions: Map<string, number>;
  /** Discrete layer index per node (0 = bottom/root). Used for stagger delay. */
  layerIndices: Map<string, number>;
  /** Bounding box of laid-out nodes. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Inner component that drives the zoom-to-target animation after layout.
 *  Must be a child of ReactFlow so useReactFlow() works. */
function ZoomAnimator({
  layoutCache,
  unlockStatuses,
}: {
  layoutCache: LayoutCache | null;
  unlockStatuses: Record<string, string>;
}) {
  const { setCenter } = useReactFlow();
  const hasAnimated = useRef(false);

  const statusCount = Object.keys(unlockStatuses).length;

  useEffect(() => {
    // Wait for both layout AND unlock statuses to be populated
    if (!layoutCache || statusCount === 0 || hasAnimated.current) return;
    hasAnimated.current = true;

    // Find target: first in_progress, else lowest-layer unlocked node
    let targetId: string | null = null;
    for (const [id, status] of Object.entries(unlockStatuses)) {
      if (status === 'in_progress') {
        targetId = id;
        break;
      }
    }
    if (!targetId) {
      let bestLayer = Infinity;
      for (const [id, status] of Object.entries(unlockStatuses)) {
        if (status === 'unlocked') {
          const layer = layoutCache.layerIndices.get(id) ?? Infinity;
          if (layer < bestLayer) {
            bestLayer = layer;
            targetId = id;
          }
        }
      }
    }

    if (!targetId) return;

    const pos = layoutCache.positions.get(targetId);
    if (!pos) return;

    // Delay zoom until after fade-in animation completes
    const timer = setTimeout(() => {
      setCenter(
        pos.x + tokens.node.elkWidth / 2,
        pos.y + tokens.node.elkHeight / 2,
        { zoom: 1.2, duration: 800 },
      );
    }, 1200);

    return () => clearTimeout(timer);
  }, [layoutCache, statusCount, unlockStatuses, setCenter]);

  return null;
}

export default function GraphView({ treeId }: { treeId?: string }) {
  return (
    <ReactFlowProvider>
      <GraphViewInner treeId={treeId} />
    </ReactFlowProvider>
  );
}

function GraphViewInner({ treeId }: { treeId?: string }) {
  const { loading } = useGraphLoader(treeId);
  const { nodes: graphNodes, edges: graphEdges, unlockStatuses, selectedNodeId, focusSet, selectNode } = useGraphStore();

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
        const xValues = result.nodes.map((n) => n.x);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const yRange = maxY - minY || 1;

        const layerFractions = new Map(
          result.nodes.map((n) => [n.id, (maxY - n.y) / yRange]),
        );

        // Discrete layer indices for stagger: bucket by y, 0 = bottom (root)
        const uniqueYs = [...new Set(yValues)].sort((a, b) => b - a); // descending y = bottom first
        const yToLayer = new Map(uniqueYs.map((y, i) => [y, i]));
        const layerIndices = new Map(
          result.nodes.map((n) => [n.id, yToLayer.get(n.y) ?? 0]),
        );

        const bounds = {
          minX,
          minY,
          maxX: maxX + tokens.node.elkWidth,
          maxY: maxY + tokens.node.elkHeight,
        };

        setLayoutCache({ positions, layerFractions, layerIndices, bounds });
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
        layerIndex: layoutCache.layerIndices.get(n.id) ?? 0,
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

      // Focus dim: edges outside the focus set dim to focusDimOpacity
      const edgeInFocus = focusSet === null ||
        (focusSet.has(e.parent_id) && focusSet.has(e.child_id));

      let edgeColor: string = tokens.graph.edgeColor;
      if (edgeInFocus) {
        if (isHighlighted) {
          edgeColor = tokens.color.edgeHighlight;
        } else if (sourceStatus === 'completed') {
          edgeColor = tokens.color.edgeCompleted;
        }
      }

      let opacity: number;
      if (!edgeInFocus) {
        opacity = tokens.color.focusDimOpacity;
      } else if (isHighlighted) {
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
  }, [graphEdges, unlockStatuses, selectedNodeId, focusSet, layoutCache]);

  // Compute translateExtent from layout bounds + padding
  const translateExtent = useMemo<[[number, number], [number, number]] | undefined>(() => {
    if (!layoutCache) return undefined;
    const { bounds } = layoutCache;
    return [
      [bounds.minX - EXTENT_PADDING, bounds.minY - EXTENT_PADDING],
      [bounds.maxX + EXTENT_PADDING, bounds.maxY + EXTENT_PADDING],
    ];
  }, [layoutCache]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => selectNode(node.id === selectedNodeId ? null : node.id),
    [selectNode, selectedNodeId],
  );

  const onPaneClick = useCallback(() => selectNode(null), [selectNode]);

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
        translateExtent={translateExtent}
        defaultEdgeOptions={{ markerEnd: undefined }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={tokens.graph.dotGridSpacing}
          size={tokens.graph.dotGridSize}
          color={tokens.graph.dotGridColor}
          style={{ opacity: tokens.graph.dotGridOpacity }}
        />
        <ZoomAnimator layoutCache={layoutCache} unlockStatuses={unlockStatuses} />
      </ReactFlow>
      <SummaryPanel />
    </div>
  );
}
