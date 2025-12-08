import type { GraphJSON, IRegistry } from '@kinforge/behave-graph';
import { useCallback, useEffect } from 'react';
import { useSystem } from '@/system';
import { useStore } from 'zustand';

/** Runs the behavior graph by building the execution
 * engine and triggering start on the lifecycle event emitter.
 *
 * This hook now delegates to the System's GraphRunner instance
 * for centralized graph execution management.
 */
export const useGraphRunner = ({
  graphJson,
  autoRun = false
}: {
  graphJson: GraphJSON | undefined;
  autoRun?: boolean;
  registry: IRegistry;
}) => {
  const system = useSystem();
  const runner = system.runner;

  // Subscribe to runner state
  const playing = useStore(system.runner.store, (state) => state.playing);
  const engine = useStore(system.runner.store, (state) => state.engine);

  const play = useCallback(() => {
    runner.play();
  }, [runner]);

  const pause = useCallback(() => {
    runner.pause();
  }, [runner]);

  const togglePlay = useCallback(() => {
    runner.togglePlay();
  }, [runner]);

  // Update the runner when the graph changes
  useEffect(() => {
    if (!graphJson) {
      return;
    }

    runner.setGraph(graphJson);

    // Auto-run if requested
    if (autoRun && !runner.store.getState().playing) {
      runner.play();
    }

    // Cleanup on unmount
    return () => {
      runner.dispose();
    };
  }, [graphJson, runner, autoRun]);

  return {
    engine,
    playing,
    play,
    togglePlay,
    pause
  };
};
