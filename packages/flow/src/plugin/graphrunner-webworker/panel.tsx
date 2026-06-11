/**
 * Panel component for Web Worker Graph Runner
 */

import React from 'react';
import { useSystem } from '@/system/provider';
import { useStore } from 'zustand';
import { BasePanel } from '@/components/panels/base';
import { VscodeButton, VscodeTextfield } from '@vscode-elements/react-elements';

import styles from '../graphrunner-local/styles.module.css';

export function WebWorkerGraphRunnerPanel() {
  const system = useSystem();
  const store = system.webWorkerGraphRunnerStore;

  const activeRuns = useStore(store, (s) => s.activeRuns);
  const isExecuting = useStore(store, (s) => s.isExecuting);
  const isPaused = useStore(store, (s) => s.isPaused);
  const tickInterval = useStore(store, (s) => s.tickInterval);
  const stepDelay = useStore(store, (s) => s.stepDelay);
  const executionSpeed = useStore(store, (s) => s.executionSpeed);

  const [tickInputValue, setTickInputValue] = React.useState(
    String(tickInterval)
  );
  const [stepDelayValue, setStepDelayValue] = React.useState(String(stepDelay));
  const [speedValue, setSpeedValue] = React.useState(String(executionSpeed));

  const handleApplyTick = () => {
    const value = parseInt(tickInputValue, 10);
    if (!isNaN(value) && value > 0) {
      store.getState().setTickInterval(value);
    }
  };

  const handleApplyStepDelay = () => {
    const value = parseInt(stepDelayValue, 10);
    if (!isNaN(value) && value >= 0) {
      store.getState().setStepDelay(value);
    }
  };

  const handleApplySpeed = () => {
    const value = parseFloat(speedValue);
    if (!isNaN(value) && value > 0) {
      store.getState().setExecutionSpeed(value);
    }
  };

  return (
    <BasePanel>
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>Web Worker Graph Runner</h3>
          <p className={styles.description}>
            Executes graphs in a separate Web Worker thread for non-blocking
            performance
          </p>
        </div>

        <div className={styles.section}>
          <h4>Status</h4>
          <div className={styles.statusGrid}>
            <div>
              <strong>Active Runs:</strong> {activeRuns}
            </div>
            <div>
              <strong>Executing:</strong> {isExecuting ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Paused:</strong> {isPaused ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4>Execution Settings</h4>

          <div className={styles.formGroup}>
            <label>Tick Interval (ms)</label>
            <p className={styles.helpText}>
              Time between tick events. Lower = faster ticking.
            </p>
            <div className={styles.inputGroup}>
              <VscodeTextfield
                value={tickInputValue}
                onInput={(e: any) => setTickInputValue(e.target.value)}
                placeholder="50"
              />
              <VscodeButton onClick={handleApplyTick}>Apply</VscodeButton>
            </div>
            <div className={styles.presetButtons}>
              <VscodeButton
                onClick={() => {
                  setTickInputValue('1000');
                  store.getState().setTickInterval(1000);
                }}
              >
                Very Slow (1000ms)
              </VscodeButton>
              <VscodeButton
                onClick={() => {
                  setTickInputValue('200');
                  store.getState().setTickInterval(200);
                }}
              >
                Slow (200ms)
              </VscodeButton>
              <VscodeButton
                onClick={() => {
                  setTickInputValue('50');
                  store.getState().setTickInterval(50);
                }}
              >
                Normal (50ms)
              </VscodeButton>
              <VscodeButton
                onClick={() => {
                  setTickInputValue('16');
                  store.getState().setTickInterval(16);
                }}
              >
                Fast (16ms)
              </VscodeButton>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Step Delay (ms)</label>
            <p className={styles.helpText}>
              Delay between execution steps. Use for debugging.
            </p>
            <div className={styles.inputGroup}>
              <VscodeTextfield
                value={stepDelayValue}
                onInput={(e: any) => setStepDelayValue(e.target.value)}
                placeholder="0"
              />
              <VscodeButton onClick={handleApplyStepDelay}>Apply</VscodeButton>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Execution Speed</label>
            <p className={styles.helpText}>
              Speed multiplier. 1.0 = normal, 0.5 = half speed, 2.0 = double
              speed.
            </p>
            <div className={styles.inputGroup}>
              <VscodeTextfield
                value={speedValue}
                onInput={(e: any) => setSpeedValue(e.target.value)}
                placeholder="1.0"
              />
              <VscodeButton onClick={handleApplySpeed}>Apply</VscodeButton>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4>About Web Worker Execution</h4>
          <p className={styles.helpText}>
            Graphs execute in a separate Web Worker thread, keeping the UI
            responsive even during intensive computations. All node execution,
            lifecycle events, and graph state management happens off the main
            thread.
          </p>
        </div>
      </div>
    </BasePanel>
  );
}
