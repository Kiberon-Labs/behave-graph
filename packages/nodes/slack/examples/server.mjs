/**
 * Example: install a node package into a server and run a workflow that a Slack
 * event triggers — driven entirely by the manifest's `backendService` standard.
 *
 * This is the exact shape a real host uses. Run it offline (no Slack app, no
 * tokens) and it simulates the Socket Mode transport so you can watch the whole
 * path execute:
 *
 *   manifest  →  loadBackendService(entry)  →  inject deps  →  run a graph that
 *   reacts to an inbound mention  →  the graph posts a reply
 *
 * Usage:
 *   node examples/server.mjs              # offline simulation (default)
 *   SLACK_SIMULATE=false node examples/server.mjs   # real Socket Mode (needs
 *     SLACK_BOT_TOKEN + SLACK_APP_TOKEN and `pnpm add @slack/socket-mode`)
 *
 * Requires the package to be built first (`pnpm build`).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import {
  DefaultLogger,
  Engine,
  ManualLifecycleEventEmitter,
  loadBackendService,
  parseManifest,
  readGraphFromJSON,
  registerCoreProfile
} from '@kiberon-labs/behave-graph';
import {
  createSlackBackendService,
  registerSlackProfile
} from '../dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const SIMULATE = process.env.SLACK_SIMULATE !== 'false';

const log = (...args) => console.log('•', ...args);

// --- 1. Discover what the installed package provides, from its manifest -------
// A host scans `package.json#behaveGraph.manifest`; here we read it directly.
const manifestPath = path.join(
  packageRoot,
  'dist',
  'behave-graph.manifest.json'
);
const manifestRaw = JSON.parse(await readFile(manifestPath, 'utf8'));
const parsed = parseManifest(manifestRaw);
if (!parsed.ok) {
  throw new Error(`Invalid manifest: ${JSON.stringify(parsed.errors)}`);
}
const manifest = parsed.manifest;

log(`package: ${manifest.package.name}`);
log(`categories: ${(manifest.categories ?? []).join(', ')}`);

const backendReq = (manifest.requirements ?? []).find(
  (r) => r.kind === 'backendService'
);
const configReq = (manifest.requirements ?? []).find(
  (r) => r.kind === 'config'
);

if (!backendReq) {
  log('package declares no backend service — nothing to boot. Done.');
  process.exit(0);
}
log(
  `needs a backend service: entry=${backendReq.entry}, ` +
    `providesTriggers=${backendReq.providesTriggers}, transport=${backendReq.transport}`
);
if (configReq) {
  const required = configReq.keys.filter((k) => k.required).map((k) => k.name);
  log(`requires config: ${required.join(', ')}`);
}

// --- 2. Resolve config the package asked for ----------------------------------
const config = SIMULATE
  ? {
      SLACK_BOT_TOKEN: 'xoxb-demo',
      SLACK_APP_TOKEN: 'xapp-demo',
      SLACK_WORKSPACE: 'T_DEMO'
    }
  : process.env;

// --- 3. Offline transport + outbound capture (simulation only) ----------------
// A fake Socket Mode client we can hand events to, and a stubbed global fetch so
// `chat.postMessage` is captured instead of hitting Slack.
const captured = [];
let simulatedSocket;
if (SIMULATE) {
  globalThis.fetch = async (url, init) => {
    captured.push({ url, body: JSON.parse(init.body) });
    return { json: async () => ({ ok: true, ts: '1700000000.000200' }) };
  };

  let handler;
  simulatedSocket = {
    on: (_event, h) => {
      handler = h;
    },
    start: async () => {},
    disconnect: async () => {},
    emit: async (event) => handler?.({ event, ack: async () => {} })
  };
}

// --- 4. Boot the backend service via the standard ----------------------------
// The host owns `import` (its trust gate) and the run-start path. In production,
// `import` resolves the manifest's `entry` from disk and the default backend
// opens a real Socket Mode connection. In simulation we hand back the real
// package backend wired to the fake socket, so the actual `src/backend.ts` start
// path runs.
const service = await loadBackendService(backendReq, {
  import: async (entry) => {
    if (SIMULATE) {
      return createSlackBackendService({
        socketFactory: () => simulatedSocket
      });
    }
    return import(pathToFileURL(path.join(packageRoot, entry)).href);
  },
  context: {
    config,
    logger: new DefaultLogger(),
    // A trigger-originating package can wake/start a graph per event. Here the
    // graph is already running, so we just log that the host was signalled.
    startRun: (req) => {
      log(
        `startRun signalled by trigger: ${JSON.stringify(req.trigger?.type)}`
      );
      return { runId: 'demo-run', stop: () => {} };
    }
  }
});

if (!service) throw new Error('backend service failed to start');
log(
  'backend service started; dependencies:',
  Object.keys(service.dependencies)
);

// --- 5. Build an execution registry with the service's dependencies merged ---
const registry = registerSlackProfile(
  registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
      ILogger: new DefaultLogger(),
      ...service.dependencies
    }
  })
);

// --- 6. Load + run a graph that reacts to a Slack mention --------------------
const graphJson = JSON.parse(
  await readFile(path.join(here, 'echo-mention.graph.json'), 'utf8')
);
const graphInstance = readGraphFromJSON({ graphJson, registry });
const engine = new Engine(graphInstance, registry);

// Drain the engine whenever the connector delivers an event. The connector is
// the injected ISlackEventSource; in this package it is a LocalSlackConnector,
// which supports addPump for exactly this.
const eventSource = service.dependencies.ISlackEventSource;
eventSource.addPump(() => void engine.executeAllAsync());

const tick = () => new Promise((r) => setTimeout(r, 30));
await tick(); // let the event nodes' subscribe() land

if (SIMULATE) {
  log('simulating an inbound @mention…');
  await simulatedSocket.emit({
    type: 'app_mention',
    channel: 'C0123DEMO',
    user: 'U_DEMO',
    text: 'hello from the example',
    ts: '1700000000.000100'
  });
  await tick();

  log(`graph posted ${captured.length} message(s):`);
  for (const call of captured) {
    log(
      `  → ${call.url.split('/').pop()} channel=${call.body.channel} text="${call.body.text}"`
    );
  }

  await service.stop();
  engine.dispose();
  log('done.');
} else {
  log('listening for Slack events. Press Ctrl+C to stop.');
  const shutdown = async () => {
    await service.stop();
    engine.dispose();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
