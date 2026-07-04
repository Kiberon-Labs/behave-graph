import { useState } from 'react';
import { useStore } from 'zustand';
import {
  VscodeButton,
  VscodeTextfield,
  VscodeBadge,
  VscodeDivider
} from '@vscode-elements/react-elements';

import styles from './styles.module.css';
import { useSystem } from '@/system/index.js';
import { BasePanel } from '@/components/panels/base';
import { SectionTitle } from '@/components/panels/common/SectionTitle';

/** A labelled numeric field with a hint, an Apply button, and the current value. */
const NumberControl = ({
  label,
  hint,
  value,
  current,
  onChange,
  onApply,
  ...inputProps
}: {
  label: string;
  hint: string;
  value: string;
  current: string;
  onChange: (value: string) => void;
  onApply: () => void;
} & Record<string, unknown>) => (
  <div className={styles.field}>
    <span className={styles.label}>{label}</span>
    <span className={styles.description}>{hint}</span>
    <div className={styles.inputRow}>
      <VscodeTextfield
        className={styles.input}
        type="number"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        {...inputProps}
      />
      <VscodeButton onClick={onApply}>Apply</VscodeButton>
    </div>
    <span className={styles.current}>Current: {current}</span>
  </div>
);

export const LocalGraphRunnerPanel = () => {
  const system = useSystem();
  const store = system.localGraphRunnerStore;
  const executionSpeed = useStore(store, (state) => state.executionSpeed);
  const stepDelay = useStore(store, (state) => state.stepDelay);
  const tickInterval = useStore(store, (state) => state.tickInterval);
  const isExecuting = useStore(store, (state) => state.isExecuting);
  const isPaused = useStore(store, (state) => state.isPaused);
  const activeRuns = useStore(store, (state) => state.activeRuns);

  const [speedInput, setSpeedInput] = useState(executionSpeed.toString());
  const [delayInput, setDelayInput] = useState(stepDelay.toString());
  const [tickIntervalInput, setTickIntervalInput] = useState(
    tickInterval.toString()
  );

  const handleSetSpeed = () => {
    const speed = parseFloat(speedInput);
    if (!isNaN(speed) && speed > 0) {
      store.getState().setExecutionSpeed(speed);
    }
  };

  const handleSetDelay = () => {
    const delay = parseInt(delayInput, 10);
    if (!isNaN(delay) && delay >= 0) {
      store.getState().setStepDelay(delay);
    }
  };

  const handleSetTickInterval = () => {
    const interval = parseInt(tickIntervalInput, 10);
    if (!isNaN(interval) && interval >= 0) {
      store.getState().setTickInterval(interval);
    }
  };

  const applyPreset = (speed: number, delay: number, tick: number) => {
    store.getState().setExecutionSpeed(speed);
    store.getState().setStepDelay(delay);
    store.getState().setTickInterval(tick);
    setSpeedInput(speed.toString());
    setDelayInput(delay.toString());
    setTickIntervalInput(tick.toString());
  };

  const statusLabel = isExecuting ? (isPaused ? 'Paused' : 'Running') : 'Idle';

  return (
    <BasePanel>
      <SectionTitle>Status</SectionTitle>
      <div className={styles.statusRow}>
        <span className={styles.label}>Status</span>
        <VscodeBadge>{statusLabel}</VscodeBadge>
      </div>
      <div className={styles.statusRow}>
        <span className={styles.label}>Active runs</span>
        <span className={styles.statusValue}>{activeRuns}</span>
      </div>

      <VscodeDivider className={styles.divider} />
      <SectionTitle>Execution Speed</SectionTitle>

      <NumberControl
        label="Speed Multiplier"
        hint="0.1 = slow, 1.0 = normal, 10 = fast"
        value={speedInput}
        current={`${executionSpeed}x`}
        onChange={setSpeedInput}
        onApply={handleSetSpeed}
        placeholder="1.0"
        min={0.01}
        max={10}
        step={0.01}
      />

      <NumberControl
        label="Step Delay (ms)"
        hint="delay between execution steps"
        value={delayInput}
        current={`${stepDelay}ms`}
        onChange={setDelayInput}
        onApply={handleSetDelay}
        placeholder="0"
        min={0}
      />

      <NumberControl
        label="Tick Interval (ms)"
        hint="delay between tick events"
        value={tickIntervalInput}
        current={`${tickInterval}ms`}
        onChange={setTickIntervalInput}
        onApply={handleSetTickInterval}
        placeholder="50"
        min={0}
      />

      <div className={styles.field}>
        <span className={styles.label}>Quick Presets</span>
        <div className={styles.presets}>
          <VscodeButton secondary onClick={() => applyPreset(0.1, 500, 1000)}>
            Very Slow
          </VscodeButton>
          <VscodeButton secondary onClick={() => applyPreset(0.5, 100, 200)}>
            Slow
          </VscodeButton>
          <VscodeButton secondary onClick={() => applyPreset(1.0, 0, 50)}>
            Normal
          </VscodeButton>
          <VscodeButton secondary onClick={() => applyPreset(5.0, 0, 16)}>
            Fast
          </VscodeButton>
        </div>
      </div>

      <VscodeDivider className={styles.divider} />
      <SectionTitle>How to Use</SectionTitle>
      <ul className={styles.helpList}>
        <li>
          <strong>Speed Multiplier:</strong> Controls how fast the engine
          executes. Lower values = slower execution, good for debugging.
        </li>
        <li>
          <strong>Step Delay:</strong> Adds a delay between each execution step.
          Useful for visualizing graph execution flow.
        </li>
        <li>
          <strong>Tick Interval:</strong> Controls the delay between tick events
          (default 50ms). Lower values = faster ticks.
        </li>
        <li>
          <strong>Pause/Step:</strong> Use the toolbar buttons to pause
          execution and step through one node at a time.
        </li>
      </ul>
    </BasePanel>
  );
};
