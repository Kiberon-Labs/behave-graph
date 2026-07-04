import {
  GraphProvider,
  System,
  SystemProvider,
  kitchenSinkPlugin,
  localGraphRunnerPlugin
} from '@kiberon-labs/behave-graph-flow';
import {
  DefaultLogger,
  ManualLifecycleEventEmitter,
  registerCoreProfile,
  writeNodeSpecsToJSON,
  type Dependencies,
  type GraphJSON
} from '@kiberon-labs/behave-graph';
import React from 'react';
import { aiPlugin } from '@/ui';
import {
  ConversationRuntime,
  registerAIProfile,
  type IAICredentials
} from '@/index';

// Host-supplied credentials , keys come from the environment, NEVER the graph.
// Resolves any provider ref to `VITE_<REF>_API_KEY`, e.g. openrouter ->
// VITE_OPENROUTER_API_KEY, openai -> VITE_OPENAI_API_KEY. The graph's ai/provider
// node only carries the non-secret ref (here, the provider kind).
const storyEnv =
  (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
const credentials: IAICredentials = {
  getApiKey: (ref) => storyEnv[`VITE_${ref.toUpperCase()}_API_KEY`]
};

// OpenRouter recommends these attribution headers (optional; help with free-tier
// rate limits). They live on the runtime-built provider config, never the graph.
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://github.com/Kiberon-Labs/behave-graph',
  'X-Title': 'behave-graph'
};

/** A free OpenRouter model , no spend, good for verifying the UI end to end. */
const FREE_MODEL = 'openai/gpt-oss-120b';

/** Poll `predicate` until it's true or the timeout elapses. */
async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 5000
): Promise<boolean> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  return predicate();
}

export interface AiStoryOptions {
  /** A behave GraphJSON to preload into the editor (an example graph). */
  graph?: GraphJSON;
}

/**
 * Build a self-contained AI story: a fresh System wired with the core + AI
 * profiles, the conversation runtime + credentials, and the dock layout. With a
 * `graph`, that graph is loaded (run it from the toolbar to fire its
 * `lifecycle/onStart`); otherwise a demo agent is connected so the chat panel is
 * immediately usable.
 */
export function makeAiStory(
  options: AiStoryOptions = {}
): React.FC<{ children: React.ReactElement }> {
  const baseDeps = {
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
    ILogger: new DefaultLogger()
  } as Dependencies;

  // Specs shown in the editor (node picker + serialization): core + AI.
  const fullRegistry = registerAIProfile(
    registerCoreProfile({ nodes: {}, values: {}, dependencies: baseDeps })
  );
  const system = new System({
    values: fullRegistry.values,
    specs: writeNodeSpecsToJSON(fullRegistry)
  });
  const session = system.createSession('graph');

  // One runtime, shared by the panel and the graph nodes; credentials injected
  // here AND into the execution registry (for the ai/generateImage node).
  const runtime = new ConversationRuntime(system, credentials);
  const executionRegistry = registerAIProfile(
    registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {
        ...baseDeps,
        IConversationService: runtime,
        IAICredentials: credentials
      } as Dependencies
    })
  );

  void (async () => {
    await system.registerPlugin(kitchenSinkPlugin);
    await system.registerPlugin(localGraphRunnerPlugin, {
      registry: executionRegistry,
      tickStrategy: async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });
    await system.registerPlugin(aiPlugin, { runtime });

    system.tabStore.getState().setLayout({
      dockbox: {
        mode: 'horizontal',
        children: [
          { size: 14, tabs: [{ id: 'graph' }], group: 'graph' },
          {
            size: 6,
            mode: 'vertical',
            children: [
              { size: 5, tabs: [{ id: 'conversations' }] },
              { size: 12, tabs: [{ id: 'conversation' }] },
              { size: 8, tabs: [{ id: 'nodeInputs' }] }
            ]
          }
        ]
      }
    });

    if (!options.graph) {
      // No graph: connect a demo agent so the chat panel is usable immediately.
      // Uses a free OpenRouter model , set VITE_OPENROUTER_API_KEY to get real
      // replies; without one, sending shows a graceful error bubble.
      runtime.setAgent({
        provider: { kind: 'openrouter', headers: OPENROUTER_HEADERS },
        model: FREE_MODEL,
        systemPrompt: 'You are a helpful assistant embedded in a node editor.',
        temperature: 0.7,
        tools: []
      });
      return;
    }

    session.flowStore.getState().setGraph(options.graph);

    // Auto-run the example so `lifecycle/onStart` fires and the conversation
    // connects without the user having to press play. The local runner connects
    // asynchronously after its plugin loads, so wait for it first.
    const connected = await waitUntil(
      () => system.runner?.store.getState().client?.isConnected() === true
    );
    if (connected) {
      await session.runController.play();
    }
  })();

  return function AiStoryProvider({
    children
  }: {
    children: React.ReactElement;
  }) {
    return (
      <SystemProvider value={system}>
        <GraphProvider value={session}>{children}</GraphProvider>
      </SystemProvider>
    );
  };
}
