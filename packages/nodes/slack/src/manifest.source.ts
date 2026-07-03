import {
  PackageCategory,
  defineManifestSource,
  type Dependencies
} from '@kiberon-labs/behave-graph';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';
import pkg from '../package.json' with { type: 'json' };

/**
 * Build-time manifest source for the slack package.
 *
 * Beyond the nodes/values every package declares, this manifest tells a host two
 * things that matter for *installing the package into a server*:
 *
 *  - `categories: ['integration']` — it wires up a third-party service.
 *  - `requirements` — it needs a **persistent backend** (Socket Mode, which holds
 *    a WebSocket open and can wake a graph) and **config** (the tokens). A host
 *    that supports backends boots `./backend.js` via `loadBackendService`; a pure
 *    editor surfaces a "needs backend / requires config" badge and still runs the
 *    action nodes once a client is injected.
 *
 * There are no UI contributions: this is a standalone connector package, not an
 * editor plugin.
 */
export default defineManifestSource({
  package: { name: pkg.name, version: pkg.version },
  registry: () => ({ nodes, values, dependencies: {} as Dependencies }),
  runtime: './index.js',
  categories: [PackageCategory.Integration],
  contributions: [],
  requirements: [
    {
      kind: 'backendService',
      entry: './backend.js',
      persistent: true,
      providesTriggers: true,
      transport: 'websocket',
      reason:
        'Slack trigger nodes need a standing Socket Mode connection to receive events.',
      dependentNodes: ['slack/onMessage', 'slack/onMention', 'slack/onReaction']
    },
    {
      kind: 'config',
      keys: [
        {
          name: 'SLACK_BOT_TOKEN',
          required: true,
          secret: true,
          description: 'Bot token (xoxb-...) used to send messages.'
        },
        {
          name: 'SLACK_APP_TOKEN',
          required: true,
          secret: true,
          description:
            'App-level token (xapp-...) used to open the Socket Mode connection.'
        },
        {
          name: 'SLACK_WORKSPACE',
          required: false,
          secret: false,
          description: 'Default team id stamped onto sends and inbound events.'
        }
      ]
    }
  ]
});
