import { useSystem, BasePanel } from '@kiberon-labs/behave-graph-flow';
import { ChatBubble, GitFork } from 'iconoir-react';
import React from 'react';
import { useStore } from 'zustand';
import { DEFAULT_CONVERSATION_ID } from '../../abstractions/types.js';
import type { ConversationNode } from '../../runtime/ConversationRuntime.js';
import styles from './conversationTree.module.css';

interface TreeEntry {
  node: ConversationNode;
  children: TreeEntry[];
}

/**
 * Arrange the flat conversation list into a forest. Children keep their
 * creation order. A node whose parent is unknown (e.g. cleared) is shown as a
 * root rather than dropped.
 */
function buildForest(conversations: ConversationNode[]): TreeEntry[] {
  const entries = new Map<string, TreeEntry>(
    conversations.map((node) => [node.id, { node, children: [] }])
  );
  const roots: TreeEntry[] = [];
  for (const entry of entries.values()) {
    const parent = entry.node.parentId
      ? entries.get(entry.node.parentId)
      : undefined;
    if (parent && parent !== entry) {
      parent.children.push(entry);
    } else {
      roots.push(entry);
    }
  }
  return roots;
}

function BranchRow({
  entry,
  focusedId,
  onFocus
}: {
  entry: TreeEntry;
  focusedId: string;
  onFocus: (id: string) => void;
}) {
  const { node, children } = entry;
  const focused = node.id === focusedId;
  const isRoot = node.id === DEFAULT_CONVERSATION_ID;
  const isFork = node.parentId !== undefined;
  const label = node.preview || (isRoot ? 'Main' : 'Branch');

  return (
    <div className={styles.branch}>
      <button
        type="button"
        className={`${styles.row} ${focused ? styles.focused : ''}`}
        onClick={() => onFocus(node.id)}
        title={node.id}
      >
        <span className={styles.icon}>
          {isFork ? <GitFork /> : <ChatBubble />}
        </span>
        <span className={styles.label}>{label}</span>
        {node.model && <span className={styles.model}>{node.model}</span>}
        <span className={styles.count}>{node.messageCount}</span>
      </button>
      {children.length > 0 && (
        <div className={styles.children}>
          {children.map((child) => (
            <BranchRow
              key={child.node.id}
              entry={child}
              focusedId={focusedId}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The exploration tree: forked conversations render nested under the branch
 * they forked from, with guide lines showing the fork structure. The focused
 * branch (the one the chat panel mirrors) is highlighted. Click a branch to
 * focus it and its history loads into the chat panel. Driven by
 * `system.conversation.store`.
 */
export const ConversationTreePanel: React.FC = () => {
  const system = useSystem();
  const runtime = system.conversation;

  const conversations = useStore(runtime.store, (s) => s.conversations);
  const focusedId = useStore(runtime.store, (s) => s.focusedId);

  const forest = React.useMemo(
    () => buildForest(conversations),
    [conversations]
  );

  const onFocus = React.useCallback(
    (id: string) => runtime.focusConversation(id),
    [runtime]
  );

  return (
    <BasePanel>
      {conversations.length === 0 ? (
        <div className={styles.empty}>No conversations yet.</div>
      ) : (
        <div className={styles.container}>
          {forest.map((entry) => (
            <BranchRow
              key={entry.node.id}
              entry={entry}
              focusedId={focusedId}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </BasePanel>
  );
};
