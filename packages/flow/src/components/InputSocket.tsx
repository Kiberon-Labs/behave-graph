import type { InputSocketSpecJSON, NodeSpecJSON } from '@kinforge/behave-graph';

import cx from 'classnames';
import React from 'react';
import { type Connection, Handle, Position, useReactFlow } from 'reactflow';

import { colors } from '../util/colors.js';
import { isValidConnection } from '../util/isValidConnection.js';
import { NavArrowRightSolid } from 'iconoir-react';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';

export type InputSocketProps = {
  hide: boolean;
  connected: boolean;
  value: any | undefined;
  onChange: (key: string, value: any) => void;
  specJSON: NodeSpecJSON[];
} & InputSocketSpecJSON;

const InputSocket: React.FC<InputSocketProps> = ({
  connected,
  specJSON,
  hide,
  ...rest
}) => {
  const { name, valueType } = rest;
  const instance = useReactFlow();
  const sys = useSystem();
  const { valueTypeColors, icons, defaultIcon } = useStore(sys.legendStore);
  const Icon = icons[valueType] ?? defaultIcon;

  const isFlowSocket = valueType === 'flow';

  let colorName = valueTypeColors[valueType];
  if (colorName === undefined) {
    colorName = 'red';
  }

  // @ts-ignore
  const [backgroundColor, borderColor] = colors[colorName];
  const showName = isFlowSocket === false || name !== 'flow';

  return (
    <div
      className={cx(
        'flex h-7 grow items-center justify-start',
        hide ? 'hidden' : ''
      )}
    >
      {isFlowSocket && <NavArrowRightSolid />}
      {showName && <div className="capitalize mr-2">{name}</div>}

      <Handle
        id={name}
        type="target"
        title={valueType}
        position={Position.Left}
        className={cx(borderColor, connected ? backgroundColor : 'bg-gray-800')}
        isValidConnection={(connection: Connection) =>
          isValidConnection(connection, instance, specJSON)
        }
      >
        <Icon />
      </Handle>
    </div>
  );
};

export default InputSocket;
