import { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { UnlockStatus } from '../../contracts/commands';
import { useGraphStore } from '../state/graph-store';
import { tokens } from '../../contracts/tokens';
import styles from './arbor-node.module.css';

export interface ArborNodeData extends Record<string, unknown> {
  label: string;
  oneLiner: string;
  status: UnlockStatus;
  /** Layer index for staggered rise animation (0 = bottom/root layer) */
  layerIndex: number;
}

export type ArborNodeType = Node<ArborNodeData, 'arbor'>;

const statusColorMap: Record<UnlockStatus, string> = {
  completed: tokens.color.completed,
  unlocked: tokens.color.unlocked,
  in_progress: tokens.color.inProgress,
  locked: tokens.color.locked,
};

const r = tokens.node.diameter / 2;
const progressArcR = r + tokens.node.progressArcGap;
const progressArcCircumference = 2 * Math.PI * progressArcR;

export default function ArborNode(props: NodeProps<ArborNodeType>) {
  const { label, status, layerIndex } = props.data;
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const focusSet = useGraphStore((s) => s.focusSet);
  const isSelected = selectedNodeId === props.id;
  const isDimmed = focusSet !== null && !focusSet.has(props.id);

  // Staggered rise: animate once on mount, then remove class
  const [rising, setRising] = useState(true);
  useEffect(() => {
    const delay = layerIndex * tokens.motion.riseStagger;
    const timer = setTimeout(() => setRising(false), delay + 400);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusColor = statusColorMap[status];
  const isUnlocked = status === 'unlocked';
  const isCompleted = status === 'completed';

  // SVG viewBox needs to encompass glow rings (which extend beyond the circle)
  const glowExtra = tokens.node.glowRingOuterSize + tokens.node.glowRingWidth;
  const svgSize = tokens.node.diameter + glowExtra * 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  const riseDelay = layerIndex * tokens.motion.riseStagger;

  const wrapperClass = [
    styles.nodeWrapper,
    rising ? styles.rising : '',
    isSelected ? styles.selected : '',
    isDimmed ? styles.dimmed : '',
  ].filter(Boolean).join(' ');

  const circleClass = [
    styles.circle,
    status === 'completed' ? styles.completed : '',
    status === 'unlocked' ? styles.unlocked : '',
    status === 'in_progress' ? styles.inProgress : '',
    status === 'locked' ? styles.locked : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div
        className={wrapperClass}
        data-testid="arbor-node"
        style={rising ? { animationDelay: `${riseDelay}ms` } : undefined}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className={styles.svgOverlay}
        >
          {/* Glow rings — unlocked only */}
          {isUnlocked && (
            <>
              <circle
                cx={cx} cy={cy}
                r={r + tokens.node.glowRingOuterSize}
                fill="none"
                stroke={tokens.color.unlocked}
                strokeWidth={tokens.node.glowRingWidth}
                opacity={tokens.node.glowRingOuterOpacity}
                className={styles.pulse}
              />
              <circle
                cx={cx} cy={cy}
                r={r + tokens.node.glowRingInnerSize}
                fill="none"
                stroke={tokens.color.unlocked}
                strokeWidth={tokens.node.glowRingWidth}
                opacity={tokens.node.glowRingInnerOpacity}
                className={styles.pulse}
              />
            </>
          )}
          {/* Main circle fill + border */}
          <circle
            cx={cx} cy={cy}
            r={r - tokens.node.borderWidthNum / 2}
            fill={tokens.color.surface}
            stroke={statusColor}
            strokeWidth={tokens.node.borderWidthNum}
            className={circleClass}
          />
          {/* Progress arc — completed status */}
          {isCompleted && (
            <circle
              cx={cx} cy={cy}
              r={progressArcR}
              fill="none"
              stroke={tokens.color.completed}
              strokeWidth={tokens.node.progressArcWidth}
              strokeDasharray={`${progressArcCircumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )}
          {/* Selection ring */}
          {isSelected && (
            <circle
              cx={cx} cy={cy}
              r={r + 3}
              fill="none"
              stroke={tokens.color.selectedRing}
              strokeWidth={2}
            />
          )}
        </svg>
        <span className={styles.label}>{label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </>
  );
}
