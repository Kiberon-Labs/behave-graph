import type {
  NodeSpecJSON,
  OutputSocketSpecJSON
} from '@kinforge/behave-graph';
import cx from 'classnames';
import { type Connection, Handle, Position, useReactFlow } from 'reactflow';
import { colors } from '../util/colors.js';
import { isValidConnection } from '../util/isValidConnection.js';
import { NavArrowRightSolid } from 'iconoir-react';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';

export type OutputSocketProps = {
  connected: boolean;
  specJSON: NodeSpecJSON[];
} & OutputSocketSpecJSON;

export default function OutputSocket({
  specJSON,
  connected,
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
  // @ts-ignore
  const [backgroundColor, borderColor] = colors[colorName];
  const showName = isFlowSocket === false || name !== 'flow';

  return (
    <div className="flex grow items-center justify-end h-7">
      {showName && <div className="capitalize">{name}</div>}
      {isFlowSocket && <NavArrowRightSolid />}

      <Handle
        id={name}
        type="source"
        position={Position.Right}
        className={cx(borderColor, connected ? backgroundColor : 'bg-gray-800')}
        isValidConnection={(connection: Connection) =>
          isValidConnection(connection, instance, specJSON)
        }
      >
        <Icon />
      </Handle>
    </div>
  );
}
