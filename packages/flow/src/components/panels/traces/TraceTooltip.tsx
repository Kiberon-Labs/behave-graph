import { memo } from 'react';
import type { HoverInfo } from './types';
import styles from './index.module.css';

type TraceTooltipProps = {
  hover: HoverInfo | null;
};

export const TraceTooltip = memo(function TraceTooltip({
  hover
}: TraceTooltipProps) {
  if (!hover?.span) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{hover.span.name}</div>
      <div className={styles.tooltipDuration}>
        {hover.durationMs?.toFixed(2)} ms
      </div>
      <div className={styles.tooltipNodeId}>{hover.span.nodeId}</div>
    </div>
  );
});
