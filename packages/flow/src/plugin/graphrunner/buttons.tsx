import { VscodeButton } from '@vscode-elements/react-elements';
import { useStore, type StoreApi } from 'zustand';
import { Play, PauseWindow, Square, ArrowRight } from 'iconoir-react';
import { useGraph } from '@/system/provider';
import type { GraphRunnerClientStore } from './store';
import type { GraphRunController } from './runController';

/**
 * Execution controls for the graph in the surrounding tab. Connection state
 * comes from the shared runner connection; run state comes from this graph's own
 * run controller, so each open graph has independent controls.
 */
export const GraphRunnerButtons = () => {
  const session = useGraph();
  const controller = session.runController;
  if (!controller) return null;
  return (
    <Buttons
      controller={controller}
      connectionStore={session.editor.runner.store}
    />
  );
};

const Buttons = ({
  controller,
  connectionStore
}: {
  controller: GraphRunController;
  connectionStore: StoreApi<GraphRunnerClientStore>;
}) => {
  const connectionState = useStore(connectionStore, (s) => s.connectionState);
  const isExecuting = useStore(controller.store, (s) => s.isExecuting);
  const isPaused = useStore(controller.store, (s) => s.isPaused);

  const isConnected = connectionState === 'connected';

  return (
    <>
      {!isExecuting && (
        <VscodeButton
          secondary
          iconOnly
          title="Play Graph"
          onClick={() => controller.play()}
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
          onClick={() => controller.pause()}
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
            onClick={() => controller.resume()}
            disabled={!isConnected}
          >
            <Play />
          </VscodeButton>
          <VscodeButton
            secondary
            iconOnly
            title="Step Forward"
            onClick={() => controller.step()}
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
        onClick={() => controller.stop()}
        disabled={!isExecuting}
      >
        <Square />
      </VscodeButton>
    </>
  );
};
