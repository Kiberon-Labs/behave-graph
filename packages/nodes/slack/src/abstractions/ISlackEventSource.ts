import type { SlackEvent, SlackTriggerDescriptor } from './types.js';

/** Called with every event that matches a subscribed descriptor. */
export type SlackEventHandler = (event: SlackEvent) => void;

/**
 * Inbound Slack: the dependency the **event** nodes (`slack/onMessage`,
 * `slack/onMention`, `slack/onReaction`) reach through
 * `graph.getDependency('ISlackEventSource')`.
 *
 * ## Why this is the important interface
 *
 * The event nodes live in the saved graph and are portable; the thing that
 * actually talks to Slack does not. This interface is the seam between them. At
 * engine startup each event node calls {@link subscribe} with a *declarative*
 * {@link SlackTriggerDescriptor} ("app_mention in C0123") plus a handler, and
 * gets back an unsubscribe function it calls on dispose. That mirrors how
 * `lifecycle/onStart` attaches to `ILifecycleEventEmitter.startEvent`.
 *
 * The split this enables:
 *
 * - **Local / in-editor** , {@link ../runtime/LocalSlackConnector} keeps the
 *   (descriptor, handler) pairs in memory and, when a raw event is handed to its
 *   `dispatch()` method, matches it with {@link matchesTrigger} and invokes the
 *   matching handlers. Good enough to build and test graphs by hand.
 *
 * - **Backend server (the real target)** , the behave-graph server loads its own
 *   Slack connector *independently of any one graph run*, holds the live Socket
 *   Mode / Events API connection, and implements this same interface. Because it
 *   can enumerate the descriptors registered across every active run, it knows
 *   precisely which Slack subscriptions/scopes to request and how to route an
 *   incoming event to the right run + node , without ever inspecting graph
 *   internals. The descriptor *is* the routing key.
 *
 * ### Driving execution
 *
 * A handler typically ends in `commit('flow')`, which enqueues a fiber on the
 * engine. The connector/host is responsible for pumping the engine
 * (`engine.executeAllAsync()`) after delivering events so those fibers run, and
 * for keeping the run alive between events (an event-driven graph is long-lived,
 * unlike a one-shot start/tick/end run). See the README for the run-loop
 * contract.
 */
export interface ISlackEventSource {
  /**
   * Register interest in a class of events. Returns an unsubscribe function.
   * The connector calls `handler` for every event matching `descriptor`.
   */
  subscribe(
    descriptor: SlackTriggerDescriptor,
    handler: SlackEventHandler
  ): () => void;
}
