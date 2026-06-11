import { VscodeButton } from '@vscode-elements/react-elements';
import { useStore } from 'zustand';
import { Play, PauseWindow, Square, ArrowRight } from 'iconoir-react';
import type { StoreApi } from 'zustand';
import type { GraphRunnerClientStore } from './store';

interface GraphRunnerButtonsProps {
  store: StoreApi<GraphRunnerClientStore>;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onStop: () => void;
}

export const GraphRunnerButtons = ({
  store,
  onPlay,
  onPause,
  onResume,
  onStep,
  onStop
}: GraphRunnerButtonsProps) => {
  const connectionState = useStore(store, (state) => state.connectionState);
  const isExecuting = useStore(store, (state) => state.isExecuting);
  const isPaused = useStore(store, (state) => state.isPaused);

  const isConnected = connectionState === 'connected';

  return (
    <>
      {!isExecuting && (
        <VscodeButton
          secondary
          iconOnly
          title="Play Graph"
          onClick={onPlay}
          disabled={!isConnected}
        >
          <Play />
        </VscodeButton>
      )}
      {isExecuting && !isPaused && (
        <VscodeButton
          secondary
          iconOnly
          title="Pause Graph"
          onClick={onPause}
          disabled={!isConnected}
        >
          <PauseWindow />
        </VscodeButton>
      )}
      {isExecuting && isPaused && (
        <>
          <VscodeButton
            secondary
            iconOnly
            title="Resume Graph"
            onClick={onResume}
            disabled={!isConnected}
          >
            <Play />
          </VscodeButton>
          <VscodeButton
            secondary
            iconOnly
            title="Step Forward"
            onClick={onStep}
            disabled={!isConnected}
          >
            <ArrowRight />
          </VscodeButton>
        </>
      )}
      <VscodeButton
        secondary
        iconOnly
        title="Stop Graph"
        onClick={onStop}
        disabled={!isExecuting}
      >
        <Square />
      </VscodeButton>
    </>
  );
};
