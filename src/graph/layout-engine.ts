import ELK from 'elkjs/lib/elk.bundled.js';

// Types for layout input/output
export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}

export interface LayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{ id: string }>;
}

// Adapter interface — swap layout algorithm without touching graph-view
export interface LayoutEngine {
  layout(nodes: LayoutNode[], edges: LayoutEdge[]): Promise<LayoutResult>;
}

export class ElkLayoutEngine implements LayoutEngine {
  private elk: InstanceType<typeof ELK>;

  constructor() {
    this.elk = new ELK();
  }

  async layout(nodes: LayoutNode[], edges: LayoutEdge[]): Promise<LayoutResult> {
    const elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'UP',
        'elk.spacing.nodeNode': '40',
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        'elk.edgeRouting': 'SPLINES',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      },
      children: nodes.map((n) => ({
        id: n.id,
        width: n.width,
        height: n.height,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    const result = await this.elk.layout(elkGraph);

    const resultNodes = (result.children ?? []).map((child) => ({
      id: child.id,
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? 0,
      height: child.height ?? 0,
    }));

    const resultEdges = (result.edges ?? []).map((edge) => ({
      id: edge.id,
    }));

    return { nodes: resultNodes, edges: resultEdges };
  }
}
