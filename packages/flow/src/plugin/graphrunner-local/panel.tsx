import { useState } from 'react';
import { useStore } from 'zustand';
import {
  VscodeButton,
  VscodeTextfield,
  VscodeLabel,
  VscodeBadge
} from '@vscode-elements/react-elements';

import styles from './styles.module.css';
import { useSystem } from '@/system/index.js';

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

  const getStatusBadge = () => {
    if (isExecuting && isPaused) {
      return <VscodeBadge>Paused</VscodeBadge>;
    }
    if (isExecuting) {
      return <VscodeBadge>Running</VscodeBadge>;
    }
    return <VscodeBadge>Idle</VscodeBadge>;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.scrollContainer}>
        <h3 className={styles.title}>Local Graph Runner</h3>

        {/* Status Section */}
        <div className={styles.section}>
          <div className={styles.statusRow}>
            <VscodeLabel>Status:</VscodeLabel>
            {getStatusBadge()}
          </div>
          <div className={styles.statusRow}>
            <VscodeLabel>Active Runs:</VscodeLabel>
            <span>{activeRuns}</span>
          </div>
        </div>

        {/* Execution Speed Controls */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Execution Speed</h4>

          <div className={styles.formGroup}>
            <VscodeLabel>
              Speed Multiplier
              <span className={styles.helpText}>
                (0.1 = slow, 1.0 = normal, 10 = fast)
              </span>
            </VscodeLabel>
            <div className={styles.inputGroup}>
              <VscodeTextfield
                value={speedInput}
                onChange={(e: any) => setSpeedInput(e.target.value)}
                placeholder="1.0"
                min={0.01}
                step={0.01}
                max={1}
                type="number"
                className={styles.formField}
              />
              <VscodeButton onClick={handleSetSpeed}>Apply</VscodeButton>
            </div>
            <div className={styles.currentValue}>
              Current: {executionSpeed}x
            </div>
          </div>

          <div className={styles.formGroup}>
            <VscodeLabel>
              Step Delay (ms)
              <span className={styles.helpText}>
                (delay between execution steps)
              </span>
            </VscodeLabel>
            <div className={styles.inputGroup}>
              <VscodeTextfield
                value={delayInput}
                onChange={(e: any) => setDelayInput(e.target.value)}
                placeholder="0"
                type="number"
                className={styles.formField}
              />
              <VscodeButton onClick={handleSetDelay}>Apply</VscodeButton>
            </div>
            <div className={styles.currentValue}>Current: {stepDelay}ms</div>
          </div>

          <div className={styles.formGroup}>
            <VscodeLabel>
              Tick Interval (ms)
              <span className={styles.helpText}>
                (delay between tick events)
              </span>
            </VscodeLabel>
            <div className={styles.inputGroup}>
              <VscodeTextfield
                value={tickIntervalInput}
                onChange={(e: any) => setTickIntervalInput(e.target.value)}
                placeholder="50"
                type="number"
                className={styles.formField}
              />
              <VscodeButton onClick={handleSetTickInterval}>Apply</VscodeButton>
            </div>
            <div className={styles.currentValue}>Current: {tickInterval}ms</div>
          </div>

          {/* Quick Presets */}
          <div className={styles.formGroup}>
            <VscodeLabel>Quick Presets</VscodeLabel>
            <div className={styles.presetButtons}>
              <VscodeButton
                secondary
                onClick={() => {
                  store.getState().setExecutionSpeed(0.1);
                  store.getState().setStepDelay(500);
                  store.getState().setTickInterval(1000);
                  setSpeedInput('0.1');
                  setDelayInput('500');
                  setTickIntervalInput('1000');
                }}
              >
                Very Slow
              </VscodeButton>
              <VscodeButton
                secondary
                onClick={() => {
                  store.getState().setExecutionSpeed(0.5);
                  store.getState().setStepDelay(100);
                  store.getState().setTickInterval(200);
                  setSpeedInput('0.5');
                  setDelayInput('100');
                  setTickIntervalInput('200');
                }}
              >
                Slow
              </VscodeButton>
              <VscodeButton
                secondary
                onClick={() => {
                  store.getState().setExecutionSpeed(1.0);
                  store.getState().setStepDelay(0);
                  store.getState().setTickInterval(50);
                  setSpeedInput('1.0');
                  setDelayInput('0');
                  setTickIntervalInput('50');
                }}
              >
                Normal
              </VscodeButton>
              <VscodeButton
                secondary
                onClick={() => {
                  store.getState().setExecutionSpeed(5.0);
                  store.getState().setStepDelay(0);
                  store.getState().setTickInterval(16);
                  setSpeedInput('5.0');
                  setDelayInput('0');
                  setTickIntervalInput('16');
                }}
              >
                Fast
              </VscodeButton>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>How to Use</h4>
          <ul className={styles.helpList}>
            <li>
              <strong>Speed Multiplier:</strong> Controls how fast the engine
              executes. Lower values = slower execution, good for debugging.
            </li>
            <li>
              <strong>Step Delay:</strong> Adds a delay between each execution
              step. Useful for visualizing graph execution flow.
            </li>
            <li>
              <strong>Tick Interval:</strong> Controls the delay between tick
              events (default 50ms). Lower values = faster ticks.
            </li>
            <li>
              <strong>Pause/Step:</strong> Use the toolbar buttons to pause
              execution and step through one node at a time.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
