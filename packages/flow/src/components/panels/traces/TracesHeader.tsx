import { memo } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';
import styles from './index.module.css';

type TracesHeaderProps = {
  size: number;
  lanes: number;
  windowMs: number;
  expanded: boolean;
  onWindowChange: (ms: number) => void;
  onToggleExpanded: () => void;
};

export const TracesHeader = memo(function TracesHeader({
  size,
  lanes,
  windowMs,
  expanded,
  onWindowChange,
  onToggleExpanded
}: TracesHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>Traces</h2>
      <div className={styles.subtitle}>Node execution spans</div>
      <div className={styles.windowControls}>
        <label className={styles.windowLabel}>
          <span>Window</span>
          <select
            className={styles.windowSelect}
            value={windowMs}
            onChange={(e) => onWindowChange(Number(e.target.value))}
          >
            <option value={100}>100 ms</option>
            <option value={500}>500 ms</option>
            <option value={1000}>1 s</option>
            <option value={5000}>5 s</option>
            <option value={30000}>30 s</option>
            <option value={0}>Fit all</option>
          </select>
        </label>
        <VscodeButton onClick={onToggleExpanded} type="button">
          {expanded ? 'Condensed' : 'Expanded'}
        </VscodeButton>
      </div>
      <div className={styles.stats}>
        <div>
          <span className={styles.statValue}>{size}</span> spans
        </div>
        <div>
          <span className={styles.statValue}>{lanes}</span> lanes
        </div>
      </div>
    </div>
  );
});
