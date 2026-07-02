import { memo } from 'react';
import type { LaneData } from './types';
import styles from './index.module.css';

type TraceLaneProps = {
  laneData: LaneData;
  laneHeight: number;
  expanded: boolean;
  hoveredSpanId: number | undefined;
};

/**
 * Renders a single lane's spans.
 *
 * Event handling for hover/click is delegated to the parent scroll
 * container via `data-*` attributes , no per-span closures needed.
 */
export const TraceLane = memo(function TraceLane({
  laneData,
  laneHeight,
  expanded,
  hoveredSpanId
}: TraceLaneProps) {
  return (
    <div
      className={styles.laneRow}
      style={{ height: laneHeight * laneData.stackCount }}
    >
      {laneData.visualSpans.map((v) => {
        const isHover = hoveredSpanId === v.span.id;
        const showLabel = expanded && v.widthPct > 5;
        return (
          <div
            key={v.span.id}
            data-trace-span=""
            data-span-id={v.span.id}
            data-node-id={v.span.nodeId}
            data-span-name={v.span.name}
            data-span-duration={v.durationMs.toFixed(2)}
            className={styles.span}
            style={{
              top: v.stack * laneHeight + 3,
              height: laneHeight - 6,
              left: `${v.leftPct}%`,
              width: `${v.widthPct}%`,
              minWidth: 3,
              backgroundColor: v.bg,
              borderColor: isHover ? 'rgba(229,231,235,0.9)' : v.border
            }}
            title={`${v.span.name}\n${v.durationMs.toFixed(2)} ms\n${v.span.nodeId}`}
          >
            {showLabel && (
              <span className={styles.spanLabel}>
                {v.span.name} ({v.durationMs.toFixed(1)}ms)
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});
