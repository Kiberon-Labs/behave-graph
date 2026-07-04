/**
 * Workflow example — registry.
 *
 * An n8n-style automation: a trigger fans into an HTTP request, branches on the
 * response status, and stores the result. It runs headlessly on the engine, the
 * way a server or cron host would run a saved automation.
 *
 * Seams demonstrated:
 *  - custom nodes mixed with the built-in `flow/branch`
 *  - typed host capabilities (an HTTP client + a result sink) provided in the
 *    registry's dependency bag and read back type-safely by capability key,
 *    instead of stringly-typed `getDependency('http')`
 *
 * Open `workflow.kbgraph` in the editor and press Run; watch the log panel.
 */
import {
  defineCapability,
  makeAsyncNodeDefinition,
  makeFlowNodeDefinition,
  makeFunctionNodeDefinition,
  ManualLifecycleEventEmitter,
  registerCoreProfile,
  type CapabilityKey,
  type Dependencies,
  type IGraph,
  type IRegistry
} from '@kiberon-labs/behave-graph';

// --- host capabilities (the "integrations") --------------------------------

export type HttpResponse = { status: number; body: string };

export interface HttpClient {
  get(url: string): Promise<HttpResponse>;
}

export interface ResultSink {
  set(key: string, value: string): void;
}

const HttpClientKey = defineCapability<HttpClient>('demo/httpClient');
const ResultSinkKey = defineCapability<ResultSink>('demo/resultSink');

/** Node-side typed read of a capability; suppresses the not-found warning. */
const readCapability = <T>(
  graph: IGraph,
  key: CapabilityKey<T>
): T | undefined =>
  (graph.getDependency as unknown as (id: string, suppress?: boolean) => T)(
    key.id,
    true
  );

// --- nodes ------------------------------------------------------------------

/** Async node: fetch a URL via the host's HTTP client capability. */
const httpRequestNode = makeAsyncNodeDefinition({
  typeName: 'workflow/httpRequest',
  label: 'HTTP Request',
  in: {
    flow: 'flow',
    url: { valueType: 'string', defaultValue: '' }
  },
  out: {
    completed: 'flow',
    status: 'float',
    body: 'string'
  },
  initialState: {},
  triggered: async ({ read, write, commit, finished = () => {}, graph }) => {
    const http = readCapability(graph, HttpClientKey);
    if (!http) {
      throw new Error('workflow/httpRequest requires an HttpClient capability');
    }
    const url = read<string>('url');
    const response = await http.get(url);
    write('status', response.status);
    write('body', response.body);
    commit('completed');
    finished();
  },
  dispose: () => ({})
});

/** Function node: is an HTTP status a success (< 400)? */
const statusOkNode = makeFunctionNodeDefinition({
  typeName: 'workflow/statusOk',
  label: 'Status OK?',
  in: { status: 'float' },
  out: { ok: 'boolean' },
  exec: ({ read, write }) => {
    write('ok', read<number>('status') < 400);
  }
});

/**
 * Flow node: write a value into the host's result sink under a configured key,
 * and echo it to the log so the run is observable in the editor.
 */
const setResultNode = makeFlowNodeDefinition({
  typeName: 'workflow/setResult',
  label: 'Set Result',
  in: {
    flow: 'flow',
    value: { valueType: 'string', defaultValue: '' }
  },
  out: {},
  initialState: {},
  configuration: { key: { valueType: 'string', defaultValue: 'result' } },
  triggered: ({ read, graph, configuration }) => {
    const sink = readCapability(graph, ResultSinkKey);
    const key = (configuration.key as string) ?? 'result';
    const value = read<string>('value');
    sink?.set(key, value);
    const logger = graph.getDependency('ILogger');
    logger?.log('info', `[result] ${key} = ${value}`);
  }
});

// --- host capability implementations ---------------------------------------

/**
 * A mock HTTP client so the example runs deterministically offline. Swap this
 * for one backed by the global `fetch` to talk to a real endpoint.
 */
const mockHttp: HttpClient = {
  async get(url: string): Promise<HttpResponse> {
    return { status: 200, body: JSON.stringify({ ok: true, url }) };
  }
};

/** A result sink that simply collects values; the node also logs each set. */
const results: Record<string, string> = {};
const resultSink: ResultSink = {
  set: (key, value) => {
    results[key] = value;
  }
};

// --- the registry -----------------------------------------------------------

export const registry: IRegistry = registerCoreProfile({
  values: {},
  nodes: {
    'workflow/httpRequest': httpRequestNode,
    'workflow/statusOk': statusOkNode,
    'workflow/setResult': setResultNode
  },
  dependencies: {
    ILogger: console,
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
    // Host capabilities live in the same open bag; capability keys read them
    // back type-safely. The per-run server overrides ILogger/lifecycle but
    // preserves these.
    [HttpClientKey.id]: mockHttp,
    [ResultSinkKey.id]: resultSink
  } as Dependencies
});
