import { getBetterBezierPath } from './offsetBezier';
import {
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps
} from 'reactflow';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';
import { EDGE_TYPE } from '@/store/settings';

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd
}: EdgeProps) => {
  const sys = useSystem();
  const edgeType = useStore(sys.systemSettings, (x) => x.edgeType);

  let edgeFn;
  switch (edgeType) {
    case EDGE_TYPE.bezier:
      edgeFn = getBetterBezierPath;
      break;
    case EDGE_TYPE.simpleBezier:
      edgeFn = getSimpleBezierPath;
      break;
    case EDGE_TYPE.smoothStep:
      edgeFn = getSmoothStepPath;
      break;
    case EDGE_TYPE.straight:
      edgeFn = getStraightPath;
      break;
    default:
      edgeFn = getBetterBezierPath;
  }

  const [edgePath] = edgeFn({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  return (
    <>
      <path className="react-flow__edge-path-back" d={edgePath} />
      <path
        id={id}
        fill="none"
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <path
        d={edgePath}
        fill="none"
        strokeOpacity="0"
        strokeWidth="20"
        className="react-flow__edge-interaction"
      />
      <text>
        <textPath
          href={`#${id}`}
          style={{ fontSize: 12 }}
          startOffset="50%"
          textAnchor="middle"
        >
          {data?.text}
        </textPath>
      </text>
    </>
  );
};
