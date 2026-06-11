import type {
  NodeSpecJSON,
  OutputSocketSpecJSON
} from '@kiberon-labs/behave-graph';
import cx from 'classnames';
import { type Connection, Handle, Position, useReactFlow } from 'reactflow';
import { isValidConnection } from '../../../util/isValidConnection.js';
import { NavArrowRightSolid } from 'iconoir-react';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';
import styles from './styles.module.css';

export type OutputSocketProps = {
  connected: boolean;
  hide?: boolean;
  specJSON: NodeSpecJSON[];
} & OutputSocketSpecJSON;

export default function OutputSocket({
  specJSON,
  connected,
  hide,
  valueType,
  name
}: OutputSocketProps) {
  const instance = useReactFlow();
  const sys = useSystem();
  const { valueTypeColors, icons, defaultIcon } = useStore(sys.legendStore);
  const Icon = icons[valueType] ?? defaultIcon;

  const isFlowSocket = valueType === 'flow';
  let colorName = valueTypeColors[valueType];
  if (colorName === undefined) {
    colorName = 'red';
  }
  const [backgroundColor, borderColor] = [colorName, colorName];
  const showName = isFlowSocket === false || name !== 'flow';

  return (
    <div className={cx(styles.row, hide ? styles.hidden : undefined)}>
      {showName && <div className={styles.name}>{name}</div>}
      {isFlowSocket && <NavArrowRightSolid />}

      <Handle
        id={name}
        type="source"
        position={Position.Right}
        style={{
          borderColor: borderColor,
          background: connected ? backgroundColor : undefined
        }}
        className={cx(styles.socket)}
        isValidConnection={(connection: Connection) =>
          isValidConnection(connection, instance, specJSON)
        }
      >
        <Icon />
      </Handle>
    </div>
  );
}
