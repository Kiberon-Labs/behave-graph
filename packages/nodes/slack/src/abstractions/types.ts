/**
 * Shared, runtime-agnostic Slack types.
 *
 * These describe the *data* that flows between nodes and whatever connector the
 * host injects. They are deliberately transport-neutral: the same shapes are
 * produced/consumed whether events arrive over Socket Mode, the Events API
 * (HTTP), or a test harness that dispatches them by hand.
 */

/**
 * How a node addresses a Slack conversation.
 *
 * `channel` may be a channel id (`C0123ABCD`, the most reliable form) or a
 * human-friendly name (`#general` / `general`). Resolving a name to an id is the
 * connector's job , the graph stays oblivious to that. `workspace` is the team
 * id (`T0123ABCD`); hosts that manage a single workspace can ignore it, while a
 * multi-tenant backend uses it to pick the right token + socket.
 */
export interface SlackChannelRef {
  channel: string;
  workspace?: string;
}

/**
 * A message to post. `text` is the fallback/plain body; `blocks` is optional
 * Block Kit JSON for a structured layout. `threadTs` replies in a thread.
 *
 * Block Kit is intentionally typed as `unknown[]` , the graph treats it as
 * opaque JSON it carries to Slack, so we don't pin a schema that Slack evolves.
 */
export interface SlackMessageSpec {
  text: string;
  blocks?: unknown[];
  /** `ts` of the parent message to reply under, if this is a threaded reply. */
  threadTs?: string;
}

/** Everything the connector needs to post one message. */
export interface SlackSendInput extends SlackChannelRef, SlackMessageSpec {}

/** Outcome of a send. `ts` is Slack's message timestamp/id on success. */
export interface SlackSendResult {
  ok: boolean;
  /** Message timestamp (`1700000000.000100`), Slack's per-channel message id. */
  ts?: string;
  /** Slack error code (e.g. `channel_not_found`) or transport error message. */
  error?: string;
}

/**
 * The kinds of inbound Slack events the graph can trigger on. Kept small and
 * normalized on purpose , add members here as new event nodes are introduced.
 */
export type SlackEventType = 'message' | 'app_mention' | 'reaction_added';

/**
 * A normalized inbound Slack event. This is the connector's contract with the
 * event nodes: whatever raw payload Slack sends, the connector maps it onto this
 * flat shape so nodes never parse Slack's wire format.
 */
export interface SlackEvent {
  type: SlackEventType;
  /** Channel id the event happened in. */
  channel: string;
  /** Team / workspace id, when the connector knows it. */
  workspace?: string;
  /** User id that caused the event. */
  user: string;
  /** Message text (empty for non-message events like reactions). */
  text: string;
  /** Message timestamp/id the event refers to. */
  ts: string;
  /** Thread parent `ts`, when the event is inside a thread. */
  threadTs?: string;
  /** Reaction (emoji) name, present only on `reaction_added`. */
  reaction?: string;
  /** The untouched raw payload, for advanced hosts/nodes that need more. */
  raw?: unknown;
}

/**
 * A node's *declarative* statement of which events it wants. This is the linchpin
 * of the local/backend split: an event node registers a descriptor (not a live
 * socket), so a host can inspect the descriptors of every running graph to decide
 * which Slack subscriptions/scopes it actually needs and how to route an incoming
 * event , all without understanding graph internals.
 *
 * `channel`/`workspace` are optional filters. Omitting `channel` means "any
 * channel the connector observes". The connector is responsible for matching an
 * incoming {@link SlackEvent} against the descriptor (see
 * {@link matchesTrigger}).
 */
export interface SlackTriggerDescriptor {
  type: SlackEventType;
  /** Restrict to a single channel (id or name). Omit for all channels. */
  channel?: string;
  /** Restrict to a single workspace/team id. Omit for all workspaces. */
  workspace?: string;
}

/**
 * Reference matcher used by in-process connectors to decide whether an event
 * satisfies a descriptor. Backend implementations may route more cleverly, but
 * they MUST stay consistent with this semantics so graphs behave identically
 * whether run locally or on the server.
 */
export function matchesTrigger(
  descriptor: SlackTriggerDescriptor,
  event: SlackEvent
): boolean {
  if (descriptor.type !== event.type) return false;
  if (
    descriptor.workspace !== undefined &&
    descriptor.workspace !== event.workspace
  ) {
    return false;
  }
  if (
    descriptor.channel !== undefined &&
    descriptor.channel !== event.channel
  ) {
    return false;
  }
  return true;
}
