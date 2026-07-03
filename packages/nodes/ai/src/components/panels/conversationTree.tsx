import { useSystem } from '@kiberon-labs/behave-graph-flow';
import React from 'react';
import { useStore } from 'zustand';
import { DEFAULT_CONVERSATION_ID } from '../../abstractions/types.js';

/**
 * Visualizes the conversation tree , one row per branch, indented by fork depth,
 * with the focused branch highlighted. Click a branch to focus it (its history
 * loads into the chat panel). Driven by `system.conversation.store`.
 */
export const ConversationTreePanel: React.FC = () => {
  const system = useSystem();
  const runtime = system.conversation;

  const conversations = useStore(runtime.store, (s) => s.conversations);
  const focusedId = useStore(runtime.store, (s) => s.focusedId);

  const byId = React.useMemo(
    () => new Map(conversations.map((c) => [c.id, c])),
    [conversations]
  );

  const depthOf = React.useCallback(
    (parentId: string | undefined): number => {
      let depth = 0;
      let current = parentId;
      // Guard against cycles with a hard cap.
      while (current && byId.has(current) && depth < 64) {
        depth += 1;
        current = byId.get(current)?.parentId;
      }
      return depth;
    },
    [byId]
  );

  if (conversations.length === 0) {
    return (
      <div style={{ padding: 12, opacity: 0.7, fontSize: 13 }}>
        No conversations yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 6,
        gap: 2,
        overflowY: 'auto'
      }}
    >
      {conversations.map((conversation) => {
        const focused = conversation.id === focusedId;
        const isRoot = conversation.id === DEFAULT_CONVERSATION_ID;
        const label =
          conversation.preview || (isRoot ? 'Main' : 'Branch');
        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => runtime.focusConversation(conversation.id)}
            title={conversation.id}
            style={{
              textAlign: 'left',
              marginLeft: depthOf(conversation.parentId) * 14,
              padding: '4px 8px',
              borderRadius: 6,
              border: focused
                ? '1px solid #6366f1'
                : '1px solid transparent',
              background: focused ? 'rgba(99,102,241,0.15)' : 'transparent',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {label}
              {conversation.model && (
                <span style={{ opacity: 0.5, fontSize: 11 }}>
                  {' '}
                  · {conversation.model}
                </span>
              )}
            </span>
            <span style={{ opacity: 0.6, fontSize: 11 }}>
              {conversation.messageCount}
            </span>
          </button>
        );
      })}
    </div>
  );
};
