import ELK from 'elkjs/lib/elk.bundled.js';
import { tokens } from '../../contracts/tokens';

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
        'elk.algorithm': tokens.elk.algorithm,
        'elk.direction': tokens.elk.direction,
        'elk.spacing.nodeNode': String(tokens.elk.nodeSpacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(tokens.elk.layerSpacing),
        'elk.edgeRouting': tokens.elk.edgeRouting,
        'elk.layered.crossingMinimization.strategy': tokens.elk.crossingMinimization,
        'elk.layered.crossingMinimization.thoroughness': tokens.elk.crossingMinimizationThoroughness,
        'elk.layered.nodePlacement.strategy': tokens.elk.nodePlacement,
        'elk.layered.compaction.postCompaction.strategy': tokens.elk.compaction,
        'elk.separateConnectedComponents': String(tokens.elk.separateConnectedComponents),
        'elk.layered.highDegreeNodes.treatment': String(tokens.elk.highDegreeNodeTreatment),
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

    // ELK's y increases downward. With direction: 'UP', layer order is
    // reversed but y still grows down. Flip y so root is at screen-bottom.
    const maxY = Math.max(...(result.children ?? []).map(c => (c.y ?? 0) + (c.height ?? 0)));
    const resultNodes = (result.children ?? []).map((child) => ({
      id: child.id,
      x: child.x ?? 0,
      y: tokens.elk.yFlip ? maxY - (child.y ?? 0) - (child.height ?? 0) : (child.y ?? 0),
      width: child.width ?? 0,
      height: child.height ?? 0,
    }));

    const resultEdges = (result.edges ?? []).map((edge) => ({
      id: edge.id,
    }));

    return { nodes: resultNodes, edges: resultEdges };
  }
}
