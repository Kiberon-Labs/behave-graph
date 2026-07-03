import type { ValueType } from '@kiberon-labs/behave-graph';
import type { SlackMessageSpec } from '../abstractions/types.js';

/**
 * Slack value types. `slackMessage` is a structured message (text + optional
 * Block Kit blocks + optional thread target) that flows through a socket and is
 * JSON-serialized when a graph is saved , mirroring how the ai package treats its
 * `aiAgent`/`aiProvider` config values (singleton, no meaningful interpolation).
 */

export const SlackMessageValue: ValueType<SlackMessageSpec> = {
  name: 'slackMessage',
  creator: () => ({ text: '' }),
  deserialize: (value: string) => JSON.parse(value) as SlackMessageSpec,
  serialize: (value: SlackMessageSpec) => JSON.stringify(value),
  lerp: (start: SlackMessageSpec, end: SlackMessageSpec, t: number) =>
    t < 0.5 ? start : end,
  equals: (a: SlackMessageSpec, b: SlackMessageSpec) => a === b,
  clone: (value: SlackMessageSpec) => ({ ...value })
};

export const values = {
  [SlackMessageValue.name]: SlackMessageValue
};
