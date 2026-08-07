import { getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { tokens } from '../../contracts/tokens';

export interface ArborEdgeData extends Record<string, unknown> {
  /** 0 = base (root) layer, 1 = crown (top) layer */
  layerFraction: number;
  /** Edge colour (default, highlight, or completed) */
  edgeColor: string;
  /** Edge opacity based on node states */
  opacity: number;
  /** Whether this edge is highlighted (selected node) */
  highlighted: boolean;
}

export default function ArborEdge({
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as ArborEdgeData | undefined;
  const layerFraction = edgeData?.layerFraction ?? 0.5;
  const edgeColor = edgeData?.edgeColor ?? tokens.graph.edgeColor;
  const opacity = edgeData?.opacity ?? tokens.graph.edgeOpacityDefault;
  const highlighted = edgeData?.highlighted ?? false;

  // Taper: interpolate width from base (thick) to crown (thin)
  const width = highlighted
    ? tokens.graph.edgeHighlightWidth
    : tokens.graph.edgeWidthBase +
      (tokens.graph.edgeWidthCrown - tokens.graph.edgeWidthBase) * layerFraction;

  const haloWidth = width + tokens.graph.edgeHaloExtra * 2;

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <>
      {/* Halo — wider stroke in background colour for crossing legibility (skip for highlighted/completed edges) */}
      {!highlighted && edgeColor === tokens.graph.edgeColor && (
        <path
          d={edgePath}
          stroke={tokens.color.edgeHalo}
          strokeWidth={haloWidth}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* Edge — coloured stroke with opacity */}
      <path
        d={edgePath}
        stroke={edgeColor}
        strokeWidth={width}
        fill="none"
        opacity={opacity}
        strokeLinecap="round"
      />
    </>
  );
}
