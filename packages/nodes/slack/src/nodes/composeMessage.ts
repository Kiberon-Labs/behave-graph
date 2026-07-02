import {
  makePureInOutFunctionDesc,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import type { SlackMessageSpec } from '../abstractions/types.js';

/**
 * Builds a structured `slackMessage` value from a fallback `text` and optional
 * Block Kit `blocks` (supplied as a JSON array string, e.g. from the Slack Block
 * Kit Builder). Feed the result into `slack/sendStructuredMessage`.
 *
 * Invalid `blocks` JSON is treated as "no blocks" rather than failing the graph ,
 * the `text` still posts as a plain message.
 */
export const ComposeMessage = makePureInOutFunctionDesc({
  typeName: 'slack/composeMessage',
  label: 'Slack: Compose Message',
  category: NodeCategory.Logic,
  in: {
    text: {
      valueType: 'string',
      defaultValue: '',
      label: 'text'
    },
    blocksJson: {
      valueType: 'string',
      defaultValue: '',
      label: 'blocks (JSON)'
    },
    threadTs: {
      valueType: 'string',
      defaultValue: '',
      label: 'thread ts'
    }
  },
  out: {
    message: 'slackMessage'
  },
  exec: ({ read, write }) => {
    const text = read<string>('text');
    const blocksJson = read<string>('blocksJson');
    const threadTs = read<string>('threadTs');

    let blocks: unknown[] | undefined;
    if (blocksJson.trim()) {
      try {
        const parsed: unknown = JSON.parse(blocksJson);
        if (Array.isArray(parsed)) {
          blocks = parsed;
        }
      } catch {
        blocks = undefined;
      }
    }

    const message: SlackMessageSpec = {
      text,
      blocks,
      threadTs: threadTs ? threadTs : undefined
    };
    write('message', message);
  }
});
