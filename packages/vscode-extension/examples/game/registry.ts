/**
 * Game example — registry.
 *
 * A fixed-timestep game loop. The `game/integrate` event node advances one
 * entity's position every tick. It runs on `RealtimeEngine` (an `Engine`
 * subclass that rides the engine's execution-strategy seam), which this module
 * selects via the exported `createEngine` factory.
 *
 * Seams demonstrated:
 *  - swapping the engine itself (`RealtimeEngine`) without changing the run
 *    server, through the `createEngine` (EngineFactory) export
 *  - an event node that subscribes to the host tick on `init` and unsubscribes
 *    on `dispose` — the same lifecycle that makes nodes safe to add/remove at
 *    runtime via `RealtimeEngine.addNode` / `removeNode` (a host-API feature not
 *    expressible in a static graph; see README)
 *  - a typed host capability (the game `World`) read back by capability key
 *
 * Open `game.kbgraph` in the editor and press Run; each tick logs the position.
 */
import {
  defineCapability,
  Engine,
  makeEventNodeDefinition,
  ManualLifecycleEventEmitter,
  RealtimeEngine,
  registerCoreProfile,
  type CapabilityKey,
  type Dependencies,
  type GraphInstance,
  type IGraph,
  type ILifecycleEventEmitter,
  type ILogger,
  type IRegistry
} from '@kiberon-labs/behave-graph';

// --- the game world (a host capability) ------------------------------------

type Entity = { x: number; vx: number };

interface World {
  entities: Map<string, Entity>;
}

const WorldKey = defineCapability<World>('demo/world');

const readCapability = <T>(graph: IGraph, key: CapabilityKey<T>): T | undefined =>
  (graph.getDependency as unknown as (id: string, suppress?: boolean) => T)(
    key.id,
    true
  );

/** A world seeded with one entity moving along +x. */
const world: World = {
  entities: new Map<string, Entity>([['a', { x: 0, vx: 1 }]])
};

// --- the integrator node ----------------------------------------------------

const DEFAULT_DT = 1 / 60;

type State = {
  handler?: () => void;
  lifecycle?: ILifecycleEventEmitter;
};

const integrateNode = makeEventNodeDefinition({
  typeName: 'game/integrate',
  label: 'Integrate Entity',
  in: {},
  out: {},
  configuration: {
    entityId: { valueType: 'string', defaultValue: '' },
    dt: { valueType: 'float', defaultValue: DEFAULT_DT }
  },
  initialState: {} as State,
  init: ({ graph, configuration }): State => {
    const w = readCapability(graph, WorldKey);
    const lifecycle = graph.getDependency('ILifecycleEventEmitter');
    const logger = graph.getDependency('ILogger') as ILogger | undefined;
    const entityId = (configuration.entityId as string) ?? '';
    const dt = (configuration.dt as number) ?? DEFAULT_DT;

    const handler = () => {
      const entity = w?.entities.get(entityId);
      if (entity) {
        entity.x += entity.vx * dt;
        logger?.log('info', `[game] ${entityId}.x = ${entity.x.toFixed(3)}`);
      }
    };
    lifecycle?.tickEvent.addListener(handler);
    return { handler, lifecycle };
  },
  dispose: ({ state }): State => {
    if (state.lifecycle && state.handler) {
      state.lifecycle.tickEvent.removeListener(state.handler);
    }
    return {};
  }
});

// --- exports the run server consumes ---------------------------------------

export const registry: IRegistry = registerCoreProfile({
  values: {},
  nodes: { 'game/integrate': integrateNode },
  dependencies: {
    ILogger: console,
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
    [WorldKey.id]: world
  } as Dependencies
});

/** Run this graph on RealtimeEngine instead of the default Engine. */
export const createEngine = (
  graph: GraphInstance,
  reg: IRegistry
): Engine => new RealtimeEngine(graph, reg);
