import type { ISlackClient } from './ISlackClient.js';
import type { ISlackEventSource } from './ISlackEventSource.js';

/**
 * Teach core's {@link Dependencies} map about the Slack dependencies via
 * declaration merging, so `graph.getDependency('ISlackClient')` and
 * `graph.getDependency('ISlackEventSource')` are type-safe inside nodes and the
 * host gets autocomplete when injecting them into the registry.
 *
 * Both are optional: a graph that only sends messages needs no event source, and
 * one that only reacts to events needs no client. Nodes already null-check the
 * result of `getDependency`, so a missing dependency degrades gracefully rather
 * than crashing , matching how core treats `IStateService`.
 *
 * This file is pure type augmentation (no runtime), but it must be part of the
 * compilation to take effect; `src/index.ts` imports it for that reason.
 */
declare module '@kiberon-labs/behave-graph' {
  interface Dependencies {
    ISlackClient?: ISlackClient;
    ISlackEventSource?: ISlackEventSource;
  }
}
