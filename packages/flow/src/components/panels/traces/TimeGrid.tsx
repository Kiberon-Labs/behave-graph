import { memo } from 'react';
import type { Tick } from './types';

const TICK_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center'
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--ds-fg-muted)',
  padding: '2px 4px',
  whiteSpace: 'nowrap'
};

type TimeGridProps = {
  ticks: Tick[];
  padding: number;
};

export const TimeGrid = memo(function TimeGrid({
  ticks,
  padding
}: TimeGridProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        height: 24,
        background: 'var(--ds-editor-bg)',
        borderBottom: '1px solid var(--ds-panel-border)',
        zIndex: 10,
        padding: `0 ${padding}px`
      }}
    >
      {ticks.map(({ time, leftPct }) => (
        <div key={time} style={{ ...TICK_STYLE, left: `${leftPct}%` }}>
          <div style={LABEL_STYLE}>{time.toFixed(0)}ms</div>
        </div>
      ))}
    </div>
  );
});
