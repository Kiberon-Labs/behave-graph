import { useSystem } from '@/system';
import { VscodeButton } from '@vscode-elements/react-elements';
import { useStore } from 'zustand';
import { useEffect, useState } from 'react';

/**
 * Event Panel - demonstrates how to interact with the graph runner
 * from a panel to manually trigger event nodes
 */
export const EventsPanel = () => {
  const system = useSystem();
  const runner = system.runner;
  const playing = useStore(system.runner.store, (state) => state.playing);
  const engine = useStore(system.runner.store, (state) => state.engine);

  const [eventNodes, setEventNodes] = useState<
    Array<{ id: string; typeName: string }>
  >([]);

  // Update event nodes list when engine changes
  useEffect(() => {
    if (engine) {
      const nodes = runner.getEventNodes();
      setEventNodes(nodes);
    } else {
      setEventNodes([]);
    }
  }, [engine, runner]);

  const handleTriggerNode = (nodeId: string) => {
    runner.triggerNode(nodeId);
  };

  const handleTogglePlay = () => {
    runner.togglePlay();
  };

  return (
    <div className="h-full w-full flex flex-col p-2 gap-2">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Event Nodes</h2>
        <VscodeButton onClick={handleTogglePlay}>
          {playing ? 'Pause' : 'Play'}
        </VscodeButton>
      </div>

      {eventNodes.length === 0 ? (
        <div className="text-gray-500 text-center py-4">
          No event nodes in the current graph
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {eventNodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center justify-between p-2 bg-gray-800 rounded hover:bg-gray-700"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{node.typeName}</span>
                <span className="text-xs text-gray-400">{node.id}</span>
              </div>
              <VscodeButton
                onClick={() => handleTriggerNode(node.id)}
                disabled={!engine}
              >
                Trigger
              </VscodeButton>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-2 border-t border-gray-700 text-xs text-gray-400">
        <p>
          This panel demonstrates how to interact with the graph runner from
          outside React components. You can trigger event nodes manually, which
          is useful for testing and debugging.
        </p>
      </div>
    </div>
  );
};
