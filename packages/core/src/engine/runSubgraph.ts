import type {
  ExecutionObserverOptions,
  InvocationContext
} from './ExecutionObserver.js';
import { Engine } from './Engine.js';
import { readGraphFromJSON } from '../Graphs/IO/readGraphFromJSON.js';
import type { GraphJSON } from '../Graphs/IO/GraphJSON.js';
import type { IRegistry } from '../types/registry.js';
import type {
  IGraphApi,
  ISubgraphRun
} from '../Profiles/Core/Subgraphs/abstractions.js';

const GRAPH_INPUT_TYPE = 'graph/input';

/** Default cap on subgraph nesting depth (defence against runaway recursion). */
export const DEFAULT_SUBGRAPH_MAX_DEPTH = 64;

export type ResolveGraph = (id: string) => GraphJSON | undefined;

export type RunSubgraphArgs = {
  graphJson: GraphJSON;
  registry: IRegistry;
  inputs?: Record<string, any>;
  /**
   * Resolver used to load and run nested subgraphs. When provided, runSubgraph
   * builds a cycle/depth-guarded `IGraphApi` for the child engine so that a
   * subgraph calling another (or itself) can never recurse forever.
   */
  resolveGraph?: ResolveGraph;
  /** Id of the graph being run (for cycle detection). */
  graphId?: string;
  /** Ids of graphs already on the call stack (ancestors). */
  stack?: string[];
  /** Max nesting depth before further calls are refused. */
  maxDepth?: number;
  observation?: ExecutionObserverOptions;
  parentInvocation?: InvocationContext;
};

/**
 * Instantiate and run a child graph to completion, returning the values its
 * `graph/output` node(s) produced.
 *
 * The caller's argument values are seeded onto the child's `graph/input`
 * boundary node(s) (which are then started); outputs are collected via a
 * per-run `ISubgraphRun` dependency injected onto the child engine.
 *
 * Recursion safety: if `resolveGraph` is supplied, nested calls are routed
 * through a guarded `IGraphApi`. A graph already on the call stack (a cycle) or
 * a stack deeper than `maxDepth` resolves to empty outputs instead of recursing,
 * so a subgraph that loops back to itself terminates gracefully.
 */
export async function runSubgraph({
  graphJson,
  registry,
  inputs = {},
  resolveGraph,
  graphId,
  stack = [],
  maxDepth = DEFAULT_SUBGRAPH_MAX_DEPTH,
  observation,
  parentInvocation
}: RunSubgraphArgs): Promise<Record<string, any>> {
  // Cycle / depth guard: refuse to run a graph already on the stack, or to nest
  // deeper than the limit.
  if (graphId !== undefined && stack.includes(graphId)) {
    parentInvocation?.emit('subgraph.skipped', { reason: 'cycle', graphId });
    return {};
  }
  if (stack.length >= maxDepth) {
    parentInvocation?.emit('subgraph.skipped', {
      reason: 'depth_limit',
      graphId,
      maxDepth
    });
    return {};
  }

  const outputs: Record<string, any> = {};
  const collector = createRunCollector(inputs, outputs);

  // The stack the child engine's nested calls see (this graph is now running).
  const childStack = graphId !== undefined ? [...stack, graphId] : [...stack];

  const guardedApi = createGuardedApi({
    registry,
    resolveGraph,
    childStack,
    maxDepth,
    observation
  });

  const childRegistry: IRegistry = {
    ...registry,
    dependencies: {
      ...registry.dependencies,
      ISubgraphRun: collector.run,
      ...(guardedApi ? { IGraphApi: guardedApi } : {})
    }
  };

  const instance = readGraphFromJSON({ graphJson, registry: childRegistry });
  const engine = new Engine(instance, childRegistry, {
    ...observation,
    parent: parentInvocation
      ? {
          executionId: parentInvocation.executionId,
          invocationId: parentInvocation.invocationId
        }
      : observation?.parent,
    deferInitialization: true
  });
  let failed = false;
  let failure: unknown;

  try {
    await engine.initialize();
    for (const node of Object.values(instance.nodes)) {
      if (node.description.typeName !== GRAPH_INPUT_TYPE) continue;
      // Seed the argument values onto the entry node's value outputs.
      for (const socket of node.outputs) {
        if (socket.valueTypeName === 'flow') continue;
        if (socket.name in inputs) socket.value = inputs[socket.name];
      }
      engine.commitToNewFiber(node, 'flow');
    }

    // Run until the subgraph returns (first `graph/output`) OR the engine goes
    // quiescent without ever returning. This is what makes a subgraph behave
    // like a function: it returns once, at the output boundary, rather than
    // running every loop iteration to completion.
    const execution = engine.executeAllAsync();
    const completion = await Promise.race([
      collector.returnSignal.then(() => 'returned' as const),
      execution.then(() => 'quiescent' as const)
    ]);
    if (completion === 'quiescent' && engine.hasPending())
      throw new Error('Subgraph execution exceeded its budget');
  } catch (error) {
    failed = true;
    failure = error;
  }
  // Stop remaining work after the first return, and attempt cleanup on failure.
  try {
    await engine.disposeAsync(failed ? 'failed' : 'completed', failure);
  } catch (cleanupError) {
    if (failed)
      throw new AggregateError(
        [failure, cleanupError],
        'Subgraph execution and cleanup failed'
      );
    throw cleanupError;
  }
  if (failed) throw failure;

  return outputs;
}

/** The per-run output collector plus the promise that resolves on first return. */
type RunCollector = {
  run: ISubgraphRun;
  returnSignal: Promise<void>;
};

// Build the `ISubgraphRun` the child engine writes through. It records outputs
// until the first `done()` (the subgraph's "return"), then ignores further
// writes so a loop hitting the output boundary again cannot clobber the result.
function createRunCollector(
  inputs: Record<string, any>,
  outputs: Record<string, any>
): RunCollector {
  let returned = false;
  let signalReturn: () => void = () => {};
  const returnSignal = new Promise<void>((resolve) => {
    signalReturn = resolve;
  });
  const run: ISubgraphRun = {
    getInput: (name) => inputs[name],
    setOutput: (name, value) => {
      // Ignore writes after the first return (a loop hitting output again).
      if (!returned) outputs[name] = value;
    },
    done: () => {
      if (!returned) {
        returned = true;
        signalReturn();
      }
    }
  };
  return { run, returnSignal };
}

// Build the cycle/depth-guarded `IGraphApi` a child engine uses to run nested
// subgraphs. Returns undefined when no resolver is available (nested calls are
// then impossible). `childStack` already includes the current graph, so any
// nested run inherits it for cycle detection.
function createGuardedApi({
  registry,
  resolveGraph,
  childStack,
  maxDepth,
  observation
}: {
  registry: IRegistry;
  resolveGraph: ResolveGraph | undefined;
  childStack: string[];
  maxDepth: number;
  observation?: ExecutionObserverOptions;
}): IGraphApi | undefined {
  if (!resolveGraph) return undefined;
  return {
    getGraph: (id) => resolveGraph(id),
    runGraph: (id, childInputs, invocation) => {
      const childGraph = resolveGraph(id);
      if (!childGraph) {
        invocation?.emit('subgraph.skipped', {
          reason: 'not_found',
          graphId: id
        });
        return Promise.resolve({});
      }
      return runSubgraph({
        graphJson: childGraph,
        registry,
        inputs: childInputs,
        resolveGraph,
        graphId: id,
        stack: childStack,
        maxDepth,
        // Each child gets its own execution identity; callbacks and capture policy are inherited.
        observation: {
          observer: observation?.observer,
          onExecution: observation?.onExecution,
          captureValue: observation?.captureValue,
          attributes: { ...observation?.attributes, graphId: id }
        },
        parentInvocation: invocation
      });
    }
  };
}
