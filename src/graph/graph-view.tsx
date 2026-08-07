import '@xyflow/react/dist/style.css';
import { useState, useEffect } from 'react';
import { ReactFlow } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { useGraphLoader } from './use-graph-loader';
import { useGraphStore } from '../state/graph-store';
import { ElkLayoutEngine } from './layout-engine';
import ArborNode from './arbor-node';
import type { ArborNodeData } from './arbor-node';
import SummaryPanel from './summary-panel';
import { tokens } from '../../contracts/tokens';
import styles from './graph-view.module.css';

const nodeTypes = { arbor: ArborNode };

const layoutEngine = new ElkLayoutEngine();

export default function GraphView({ treeId }: { treeId?: string }) {
  const { loading } = useGraphLoader(treeId);
  const { nodes: graphNodes, edges: graphEdges, unlockStatuses, selectedNodeId, selectNode } = useGraphStore();

  const [flowNodes, setFlowNodes] = useState<Node<ArborNodeData>[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);

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
        const positionMap = new Map(result.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

        const newFlowNodes: Node<ArborNodeData>[] = graphNodes.map((n) => ({
          id: n.id,
          type: 'arbor',
          position: positionMap.get(n.id) ?? { x: 0, y: 0 },
          data: {
            label: n.title,
            oneLiner: n.one_liner,
            status: unlockStatuses[n.id] ?? 'locked',
          },
        }));

        const newFlowEdges: Edge[] = graphEdges.map((e) => ({
          id: String(e.id),
          source: e.parent_id,
          target: e.child_id,
          type: 'straight',
          style: { stroke: tokens.graph.edgeColor },
        }));

        setFlowNodes(newFlowNodes);
        setFlowEdges(newFlowEdges);
      })
      .catch(() => {
        // layout failed — leave nodes unpositioned
      });
  }, [graphNodes, graphEdges, unlockStatuses]);

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
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_event, node) => selectNode(node.id === selectedNodeId ? null : node.id)}
        onPaneClick={() => selectNode(null)}
      />
      <SummaryPanel />
    </div>
  );
}
