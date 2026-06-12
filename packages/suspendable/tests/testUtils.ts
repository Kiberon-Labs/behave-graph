import {
  ManualLifecycleEventEmitter,
  readGraphFromJSON,
  registerCoreProfile,
  type GraphJSON,
  type IRegistry
} from '@kiberon-labs/behave-graph';
import { SuspendableEngine } from '../src/engine';

/**
 * Builds an isolated engine over the given graph JSON. Each call produces a
 * fresh registry, lifecycle emitter, graph and engine so that suspension
 * round-trips can be tested across truly independent engine instances (as if
 * resuming in a new process).
 */
export const makeTestEngine = (
  graphJson: GraphJSON,
  extraNodes: Record<string, unknown> = {}
) => {
  const lifecycle = new ManualLifecycleEventEmitter();
  const registry: IRegistry = registerCoreProfile({
    values: {},
    nodes: {},
    dependencies: {
      ILifecycleEventEmitter: lifecycle
    }
  });
  Object.assign(registry.nodes, extraNodes);

  const graph = readGraphFromJSON({ graphJson, registry });
  const engine = new SuspendableEngine(graph, registry);

  /** Emits the lifecycle start event, queueing the onStart fiber. */
  const start = () => lifecycle.startEvent.emit();

  return { engine, graph, registry, lifecycle, start };
};
