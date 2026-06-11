import { getBetterBezierPath } from './offsetBezier';
import {
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
  useReactFlow,
  Position
} from 'reactflow';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';
import { EDGE_TYPE } from '@/store/settings';
import { useState, useCallback, type MouseEvent } from 'react';

interface ControlPoint {
  x: number;
  y: number;
}

// Generate path for different edge types with control points
function generatePathWithControlPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  controlPoints: ControlPoint[],
  edgeType: string,
  _sourcePosition?: Position,
  _targetPosition?: Position
): string {
  if (controlPoints.length === 0) {
    // No control points, use default edge type
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

    const [path] = edgeFn({
      sourceX,
      sourceY,
      sourcePosition: _sourcePosition,
      targetX,
      targetY,
      targetPosition: _targetPosition
    });
    return path;
  }

  // Build path through all control points
  const allPoints = [
    { x: sourceX, y: sourceY },
    ...controlPoints,
    { x: targetX, y: targetY }
  ];

  if (edgeType === EDGE_TYPE.straight) {
    // Straight lines through all points
    const pathParts = allPoints.map((p, i) =>
      i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`
    );
    return pathParts.join(' ');
  } else if (edgeType === EDGE_TYPE.smoothStep) {
    // Smooth step style through control points
    let path = `M ${allPoints[0]?.x},${allPoints[0]?.y}`;
    for (let i = 0; i < allPoints.length - 1; i++) {
      const current = allPoints[i];
      const next = allPoints[i + 1];
      if (!current || !next) continue;
      const midX = (current.x + next.x) / 2;
      // Create smooth step
      path += ` L ${midX},${current.y} L ${midX},${next.y}`;
    }
    path += ` L ${allPoints[allPoints.length - 1]?.x},${allPoints[allPoints.length - 1]?.y}`;
    return path;
  } else {
    // Bezier curve through all points
    if (allPoints.length === 2) {
      return `M ${allPoints[0]?.x},${allPoints[0]?.y} L ${allPoints[1]?.x},${allPoints[1]?.y}`;
    } else if (allPoints.length === 3) {
      return `M ${allPoints[0]?.x},${allPoints[0]?.y} Q ${allPoints[1]?.x},${allPoints[1]?.y} ${allPoints[2]?.x},${allPoints[2]?.y}`;
    } else {
      // For multiple control points, use cubic bezier segments
      let path = `M ${allPoints[0]?.x},${allPoints[0]?.y}`;
      for (let i = 0; i < allPoints.length - 1; i++) {
        const p1 = allPoints[i + 1];
        if (!p1) continue;

        if (i === allPoints.length - 2) {
          // Last segment
          path += ` L ${p1.x},${p1.y}`;
        } else {
          // Smooth curve using quadratic bezier
          path += ` Q ${p1.x},${p1.y}`;
          if (i < allPoints.length - 2) {
            const p2 = allPoints[i + 2];
            if (p2) {
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              path += ` ${midX},${midY}`;
            }
          }
        }
      }
      return path;
    }
  }
}

type CustomEdgeProps = EdgeProps & {
  data: {
    controlPoints?: ControlPoint[];
    text?: string;
  };
};

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected
}: CustomEdgeProps) => {
  const sys = useSystem();
  const edgeType = useStore(sys.systemSettings, (x) => x.edgeType);
  const snapGrid = useStore(sys.systemSettings, (x) => x.snapGrid);
  const gridSize = useStore(sys.systemSettings, (x) => x.gridSize);
  const { setEdges } = useReactFlow();

  // Get control points from edge data
  const controlPoints: ControlPoint[] = data?.controlPoints || [];
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleDoubleClick = useCallback(
    (event: MouseEvent<SVGPathElement>) => {
      event.stopPropagation();

      // Get click position on SVG
      const svgElement = (event.target as SVGElement).ownerSVGElement;
      if (!svgElement) return;

      const point = svgElement.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const svgPoint = point.matrixTransform(
        svgElement.getScreenCTM()?.inverse()
      );

      // Build array of all points (source -> control points -> target)
      const allPoints = [
        { x: sourceX, y: sourceY },
        ...controlPoints,
        { x: targetX, y: targetY }
      ];

      // Find which segment was clicked by finding closest segment
      let closestSegmentIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < allPoints.length - 1; i++) {
        const p1 = allPoints[i];
        const p2 = allPoints[i + 1];
        if (!p1 || !p2) continue;

        // Calculate distance from click point to line segment
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lengthSquared = dx * dx + dy * dy;

        let t = 0;
        if (lengthSquared > 0) {
          t = Math.max(
            0,
            Math.min(
              1,
              ((svgPoint.x - p1.x) * dx + (svgPoint.y - p1.y) * dy) /
                lengthSquared
            )
          );
        }

        const projX = p1.x + t * dx;
        const projY = p1.y + t * dy;
        const distance = Math.sqrt(
          (svgPoint.x - projX) ** 2 + (svgPoint.y - projY) ** 2
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestSegmentIndex = i;
        }
      }

      // Insert the new control point at the correct position
      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.id !== id) return edge;

          const currentPoints = edge.data?.controlPoints || [];
          const newPoints = [...currentPoints];

          // closestSegmentIndex 0 means between source and first control point (or target if no control points)
          // So we insert at index closestSegmentIndex
          newPoints.splice(closestSegmentIndex, 0, {
            x: svgPoint.x,
            y: svgPoint.y
          });

          return {
            ...edge,
            data: {
              ...edge.data,
              controlPoints: newPoints
            }
          };
        })
      );
    },
    [id, sourceX, sourceY, targetX, targetY, controlPoints, setEdges]
  );

  const handleControlPointMouseDown = useCallback(
    (event: MouseEvent<SVGGElement>, index: number) => {
      event.stopPropagation();
      setDraggingIndex(index);

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const svgElement = (event.target as SVGElement).ownerSVGElement;
        if (!svgElement) return;

        const point = svgElement.createSVGPoint();
        point.x = moveEvent.clientX;
        point.y = moveEvent.clientY;
        const svgPoint = point.matrixTransform(
          svgElement.getScreenCTM()?.inverse()
        );

        // Snap to grid if enabled
        let x = svgPoint.x;
        let y = svgPoint.y;
        if (snapGrid) {
          x = Math.round(x / gridSize) * gridSize;
          y = Math.round(y / gridSize) * gridSize;
        }

        setEdges((edges) =>
          edges.map((edge) => {
            if (edge.id !== id) return edge;
            const points: ControlPoint[] = edge.data?.controlPoints || [];
            const newPoints = [...points];
            newPoints[index] = { x, y };
            return {
              ...edge,
              data: {
                ...edge.data,
                controlPoints: newPoints
              }
            };
          })
        );
      };

      const handleMouseUp = () => {
        setDraggingIndex(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [id, snapGrid, gridSize, setEdges]
  );

  const handleRemoveControlPoint = useCallback(
    (event: MouseEvent, index: number) => {
      event.stopPropagation();
      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.id !== id) return edge;
          const points: ControlPoint[] = edge.data?.controlPoints || [];
          const newPoints = points.filter((_, i) => i !== index);
          return {
            ...edge,
            data: {
              ...edge.data,
              controlPoints: newPoints
            }
          };
        })
      );
    },
    [id, setEdges]
  );

  const edgePath = generatePathWithControlPoints(
    sourceX,
    sourceY,
    targetX,
    targetY,
    controlPoints,
    edgeType,
    sourcePosition,
    targetPosition
  );

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
        onDoubleClick={handleDoubleClick}
        style={{ cursor: 'pointer' }}
      />

      {/* Render control points - only when selected */}
      {selected &&
        controlPoints.map((point, index) => {
          const isDragging = draggingIndex === index;
          return (
            <g
              key={`cp-${index}`}
              onMouseDown={(e) => handleControlPointMouseDown(e, index)}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              {/* Large invisible hit area for easier selection */}
              <circle
                cx={point.x}
                cy={point.y}
                r={15}
                fill="transparent"
                strokeWidth={0}
                pointerEvents="all"
              />
              {/* Visible control point */}
              <circle
                cx={point.x}
                cy={point.y}
                r={7}
                fill="#4CAF50"
                stroke="#fff"
                strokeWidth={2}
                pointerEvents="none"
              />
              {/* Remove button (X) */}
              <g
                onClick={(e) => handleRemoveControlPoint(e, index)}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
              >
                <circle
                  cx={point.x + 10}
                  cy={point.y - 10}
                  r={6}
                  fill="#f44336"
                  stroke="#fff"
                  strokeWidth={1}
                />
                <text
                  x={point.x + 10}
                  y={point.y - 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize="10"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  ×
                </text>
              </g>
            </g>
          );
        })}

      {/* Guide lines showing control point influence - only when selected */}
      {selected &&
        controlPoints.length > 0 &&
        controlPoints[0] &&
        controlPoints[controlPoints.length - 1] && (
          <>
            <line
              x1={sourceX}
              y1={sourceY}
              x2={controlPoints[0].x}
              y2={controlPoints[0].y}
              stroke="#4CAF50"
              strokeWidth={1}
              strokeDasharray="3,3"
              opacity={0.2}
              pointerEvents="none"
            />
            {controlPoints.map((point, index) => {
              if (index < controlPoints.length - 1) {
                const nextPoint = controlPoints[index + 1];
                if (!nextPoint || !point) return null;
                return (
                  <line
                    key={`guide-${index}`}
                    x1={point.x}
                    y1={point.y}
                    x2={nextPoint.x}
                    y2={nextPoint.y}
                    stroke="#4CAF50"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                    opacity={0.2}
                    pointerEvents="none"
                  />
                );
              }
              return null;
            })}
            {controlPoints[controlPoints.length - 1] && (
              <line
                x1={controlPoints[controlPoints.length - 1]!.x}
                y1={controlPoints[controlPoints.length - 1]!.y}
                x2={targetX}
                y2={targetY}
                stroke="#4CAF50"
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.2}
                pointerEvents="none"
              />
            )}
          </>
        )}

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
