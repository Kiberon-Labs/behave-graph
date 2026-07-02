import type { GraphJSON } from '../../../Graphs/IO/GraphJSON.js';

/**
 * Resolves and runs referenced graphs for {@link CallSubgraph} nodes. Provided
 * as a dependency by the host/runner, which owns the registry and the set of
 * available graphs.
 */
export interface IGraphApi {
  /** Resolve a referenced graph's JSON (for tools / introspection). */
  getGraph(id: string): GraphJSON | undefined;
  /** Instantiate and run a referenced graph, returning its output values. */
  runGraph(
    id: string,
    inputs: Record<string, any>
  ): Promise<Record<string, any>>;
}

/**
 * Per-run data channel between a subgraph's boundary nodes and the runner that
 * invoked it. Injected as a dependency on the child engine for the duration of
 * one subgraph run.
 */
export interface ISubgraphRun {
  /** Argument value passed in for a named graph input. */
  getInput(name: string): any;
  /** Record a value produced for a named graph output. */
  setOutput(name: string, value: any): void;
  /**
   * Signal that an output boundary was reached , i.e. the subgraph "returned".
   * The first call resolves the run with the captured outputs; later calls (e.g.
   * a loop hitting `graph/output` again) are ignored, so a subgraph behaves like
   * a function with a single return.
   */
  done(): void;
}
