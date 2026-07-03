import type {
  InputSocketSpecJSON,
  NodeSpecJSON
} from '@kiberon-labs/behave-graph';

import cx from 'classnames';
import React from 'react';
import { type Connection, Handle, Position, useReactFlow } from 'reactflow';

import { isValidConnection } from '../../../util/isValidConnection.js';
import { NavArrowRightSolid } from 'iconoir-react';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';

import styles from './styles.module.css';

export type InputSocketProps = {
  hide: boolean;
  hideName?: boolean;
  connected: boolean;
  value: any | undefined;
  label?: string;
  onChange: (key: string, value: any) => void;
  specJSON: NodeSpecJSON[];
} & InputSocketSpecJSON;

const InputSocket: React.FC<InputSocketProps> = ({
  connected,
  specJSON,
  hideName,
  hide,
  label,
  ...rest
}) => {
  const { name, valueType } = rest;
  const instance = useReactFlow();
  const sys = useSystem();
  const { valueTypeColors, icons, defaultIcon } = useStore(sys.legendStore);
  const autoConvert = useStore(sys.systemSettings, (s) => s.autoConvert);
  const conversions = useStore(sys.conversionStore, (s) => s.conversions);
  const Icon = icons[valueType] ?? defaultIcon;

  const isFlowSocket = valueType === 'flow';

  let colorName = valueTypeColors[valueType];
  if (colorName === undefined) {
    colorName = '#c2410c';
  }
  const showName =
    hideName !== true && (isFlowSocket === false || name !== 'flow');

  return (
    <div className={cx(styles.row, hide ? styles.hidden : undefined)}>
      {isFlowSocket && <NavArrowRightSolid />}
      {showName && <div className={styles.name}>{label ?? name}</div>}

      <Handle
        id={name}
        type="target"
        title={valueType}
        position={Position.Left}
        style={{
          borderColor: colorName,
          background: colorName
        }}
        className={cx(
          styles.socket,
          connected ? undefined : styles.disconnected
        )}
        isValidConnection={(connection: Connection) =>
          isValidConnection(connection, instance, specJSON, {
            autoConvert,
            conversions
          })
        }
      >
        <Icon />
      </Handle>
    </div>
  );
};

export default InputSocket;
