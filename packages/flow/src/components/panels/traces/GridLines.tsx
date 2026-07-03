import { memo } from 'react';
import type { Tick } from './types';

const LINE_STYLE_BASE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 1,
  backgroundColor: 'var(--ds-panel-border)',
  opacity: 0.3
};

type GridLinesProps = {
  ticks: Tick[];
  padding: number;
};

export const GridLines = memo(function GridLines({
  ticks,
  padding
}: GridLinesProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: padding,
        right: padding,
        bottom: 0,
        pointerEvents: 'none'
      }}
    >
      {ticks.map(({ time, leftPct }) => (
        <div key={time} style={{ ...LINE_STYLE_BASE, left: `${leftPct}%` }} />
      ))}
    </div>
  );
});
