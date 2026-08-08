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
  /** Whether this edge is on the critical path from root to selected node */
  onCriticalPath: boolean;
}

export default function ArborEdge({
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as ArborEdgeData | undefined;
  const layerFraction = edgeData?.layerFraction ?? 0.5;
  const edgeColor = edgeData?.edgeColor ?? 'var(--graph-edge-color)';
  const opacity = edgeData?.opacity ?? tokens.graph.edgeOpacityDefault;
  const highlighted = edgeData?.highlighted ?? false;
  const onCriticalPath = edgeData?.onCriticalPath ?? false;

  // Taper: interpolate width from base (thick) to crown (thin)
  let width = tokens.graph.edgeWidthBase +
    (tokens.graph.edgeWidthCrown - tokens.graph.edgeWidthBase) * layerFraction;
  if (highlighted) width = tokens.graph.edgeHighlightWidth;
  if (onCriticalPath) width = Math.max(width, 2.5);

  const effectiveColor = onCriticalPath ? 'var(--color-selected-ring)' : edgeColor;
  const effectiveOpacity = onCriticalPath ? 0.7 : opacity;

  const haloWidth = width + tokens.graph.edgeHaloExtra * 2;

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const transition = `opacity ${tokens.motion.durationEdgeHighlight} ${tokens.motion.easing}, stroke ${tokens.motion.durationEdgeHighlight} ${tokens.motion.easing}, stroke-width ${tokens.motion.durationEdgeHighlight} ${tokens.motion.easing}`;

  return (
    <>
      {/* Halo — wider stroke in background colour for crossing legibility */}
      {!highlighted && !onCriticalPath && (
        <path
          d={edgePath}
          stroke="var(--graph-background)"
          strokeWidth={haloWidth}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* Edge — coloured stroke with opacity */}
      <path
        d={edgePath}
        stroke={effectiveColor}
        strokeWidth={width}
        fill="none"
        opacity={effectiveOpacity}
        strokeLinecap="round"
        style={{ transition }}
      />
    </>
  );
}
