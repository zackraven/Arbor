import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { UnlockStatus } from '../../contracts/commands';
import { useGraphStore } from '../state/graph-store';
import styles from './arbor-node.module.css';

export interface ArborNodeData extends Record<string, unknown> {
  label: string;
  oneLiner: string;
  status: UnlockStatus;
}

export type ArborNodeType = Node<ArborNodeData, 'arbor'>;

const statusClassMap: Record<UnlockStatus, string> = {
  completed: styles.completed ?? '',
  unlocked: styles.unlocked ?? '',
  in_progress: styles.inProgress ?? '',
  locked: styles.locked ?? '',
};

export default function ArborNode(props: NodeProps<ArborNodeType>) {
  const { label, status } = props.data;
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const isSelected = selectedNodeId === props.id;

  const statusClass = statusClassMap[status] ?? '';

  const className = [styles.node, statusClass, isSelected ? styles.selected : '']
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className={styles.handle}
      />
      <div className={className}>
        <span className={styles.label}>{label}</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={styles.handle}
      />
    </>
  );
}
