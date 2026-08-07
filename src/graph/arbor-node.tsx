import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { UnlockStatus } from '../../contracts/commands';
import styles from './arbor-node.module.css';

export interface ArborNodeData extends Record<string, unknown> {
  label: string;
  oneLiner: string;
  status: UnlockStatus;
}

export type ArborNodeType = Node<ArborNodeData, 'arbor'>;

export default function ArborNode(props: NodeProps<ArborNodeType>) {
  const { label } = props.data;
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className={styles.handle}
      />
      <div className={styles.node}>
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
