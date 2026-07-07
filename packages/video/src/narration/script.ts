// The single source of truth for the demo tour: what the voice says, which visual
// runs underneath it, and how the editor is driven while the line plays.
//
// `pnpm voice` reads this file, synthesizes one MP3 per scene, and writes a timing
// manifest; the composition then sizes every scene to its voice line. Until the
// manifest exists, scenes fall back to `fallbackSeconds` and play silent  so the
// Remotion studio works before any TTS key is configured.
//
// This file is imported by the Node-side voice script too, so it must stay free
// of Remotion imports; scenes reference their graph by key (see graphs.ts).

interface BaseScene {
  /** Stable id  names the MP3 file and the manifest entry. Changing it orphans old audio. */
  id: string;
  /** The voiceover line for this scene. Keep it speakable: short sentences, no markup. */
  text: string;
  /** Scene length (seconds) when no narration manifest has been generated yet. */
  fallbackSeconds: number;
  /** Visual padding (seconds) after the voice line ends. Default 1. */
  tailSeconds?: number;
}

/**
 * A scripted interaction, fired once when the playhead crosses `at` (a 0..1
 * fraction of the scene, so actions survive narration retiming). Actions drive
 * the editor through its real stores  selection, tabs, parameter values, the
 * graph runner  which is what makes the video read as someone using the tool.
 */
export type SceneAction =
  | { at: number; do: 'play' }
  | { at: number; do: 'openTab'; tab: string }
  | { at: number; do: 'selectNode'; nodeId: string }
  | {
      at: number;
      do: 'setParam';
      nodeId: string;
      port: string;
      value: unknown;
    }
  | {
      at: number;
      do: 'chat';
      role: 'user' | 'assistant';
      content: string;
    }
  | {
      /** Identity write to the node store: visually a no-op, but it makes the
       *  realtime preview runner re-evaluate (its results go stale when async
       *  sources  e.g. image/fetch  resolve after its first pass). */
      at: number;
      do: 'nudge';
    }
  | {
      /** Re-dock the left sidebar into two stacked panels, one per tab  so
       *  two authoring panels (e.g. Variables + Events) are visible at once. */
      at: number;
      do: 'splitLeft';
      tabs: [string, string];
    };

export interface EditorSceneSpec extends BaseScene {
  kind: 'editor';
  /** Which graph to load  a key resolved by `compositions/graphs.ts`. */
  graphKey: string;
  /** Lower-third caption shown while the scene plays. */
  caption: string;
  /** Register the ImageMagick node pack (wasm) before building the editor. */
  imageNodes?: boolean;
  /** Register the AI node pack before building the editor. */
  aiNodes?: boolean;
  /** Overlay the before → after image card (the image-pipeline payoff). */
  imagePayoff?: boolean;
  /**
   * Milliseconds between execution steps (the runner's own pacing setting).
   * Slowing the run is what makes the per-node execution highlight visible on
   * camera and keeps trace spans inside the traces panel's rolling window.
   */
  stepDelayMs?: number;
  /** Milliseconds between engine ticks for tick-driven (onTick) graphs. */
  tickIntervalMs?: number;
  /** Scripted interactions, in scene order. */
  actions?: SceneAction[];
}

export type NarrationScene =
  | (BaseScene & { kind: 'intro' | 'outro' })
  | EditorSceneSpec;

export const SCENES: NarrationScene[] = [
  {
    id: 'intro',
    kind: 'intro',
    text:
      'Behavior wants to be a graph: events, conditions, actions, wired together. ' +
      'Behave graph is an open-source behavior-graph engine in portable TypeScript, ' +
      'with a full visual editor on top. ' +
      'Here is the tour.',
    fallbackSeconds: 18
  },
  {
    id: 'editor',
    kind: 'editor',
    graphKey: 'gameLoot',
    caption: 'Visual scripting in the browser',
    actions: [
      { at: 0.35, do: 'selectNode', nodeId: '2' },
      {
        at: 0.6,
        do: 'setParam',
        nodeId: '3',
        port: 'text',
        value: 'Legendary drop! The crowd goes wild.'
      }
    ],
    text:
      'This is Flow: visual scripting in your browser, the way the big game engines do it. ' +
      'Typed sockets, real branching, dockable panels. Click a node and its inputs are right there  ' +
      'edit them live, and underneath, the whole graph stays plain JSON.',
    fallbackSeconds: 14
  },
  {
    id: 'run',
    kind: 'editor',
    graphKey: 'heartbeat',
    caption: 'Run it live  logs & traces',
    stepDelayMs: 150,
    tickIntervalMs: 800,
    actions: [
      { at: 0.15, do: 'openTab', tab: 'logs' },
      { at: 0.28, do: 'play' },
      { at: 0.68, do: 'openTab', tab: 'traces' }
    ],
    text:
      'Press play, and the graph runs right here  this one wakes on every engine tick. ' +
      'Nodes light up as execution passes through them, each tick lands in the output panel, ' +
      'and the trace timeline shows exactly what ran, and when.',
    fallbackSeconds: 13
  },
  {
    id: 'image',
    kind: 'editor',
    graphKey: 'imagePipeline',
    caption: 'ImageMagick nodes  real work, in the browser',
    imageNodes: true,
    imagePayoff: true,
    // No run and no execution cursor here: the realtime preview runner ticks
    // on its own while thumbnails are watched, and extra store writes would
    // just make it re-evaluate the whole wasm pipeline more often.
    text:
      'Nodes can do real work. This pipeline fetches a photo and layers ImageMagick effects  ' +
      'resize, oil-paint, sepia  compiled to WebAssembly, running in the browser. ' +
      'With previews on, you can watch the image change at every node.',
    fallbackSeconds: 14
  },
  {
    id: 'primitives',
    kind: 'editor',
    graphKey: 'primitives',
    caption: 'Variables & custom events',
    actions: [{ at: 0.25, do: 'splitLeft', tabs: ['variables', 'events'] }],
    text:
      'State and signalling are built in. Graph variables hold values you can set and read anywhere. ' +
      'Custom events let one part of the graph trigger another  declare them once, ' +
      'and fire them from wherever the flow demands.',
    fallbackSeconds: 13
  },
  {
    id: 'ai',
    kind: 'editor',
    graphKey: 'aiConversation',
    caption: 'AI nodes  wire a conversation',
    aiNodes: true,
    actions: [
      { at: 0.2, do: 'selectNode', nodeId: '5' },
      { at: 0.42, do: 'openTab', tab: 'conversation' },
      {
        at: 0.52,
        do: 'chat',
        role: 'user',
        content: 'Welcome the player and offer them a quest.'
      },
      {
        at: 0.68,
        do: 'chat',
        role: 'assistant',
        content:
          'Welcome, traveler! The miller has lost his ledger near the old watchtower  bring it back and the reward is yours. Do you accept?'
      }
    ],
    text:
      'There is a plugin for AI, too: wire a provider, an agent and a conversation, then send messages ' +
      'from anywhere in the flow and use the reply like any other value  ' +
      'with the whole exchange right there in the conversation panel. ' +
      'And since a graph can only call the nodes you hand it, whatever runs in here stays sandboxed  ' +
      'in a game, a tool, or a headless workflow.',
    fallbackSeconds: 18
  },
  {
    id: 'outro',
    kind: 'outro',
    text:
      'Behave graph, by Kiberon Labs. Open source, on npm today  ' +
      'documentation available at behave dot kiberonlabs dot com.',
    fallbackSeconds: 10,
    tailSeconds: 2
  }
];
