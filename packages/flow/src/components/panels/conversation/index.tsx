import React, { useCallback, useEffect, useRef } from 'react';
import { VscodeButton, VscodeTextfield } from '@vscode-elements/react-elements';
import { Trash, SendDiagonal } from 'iconoir-react';
import { useSystem } from '@/system/provider';
import { useStore } from 'zustand';
import { BasePanel } from '../base';
import { Icon } from '@/components/primitives/icon';
import type { ChatMessage } from '@/store/chat';
import styles from './index.module.css';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const roleClass =
    message.role === 'user'
      ? styles.userMessage
      : message.role === 'assistant'
        ? styles.assistantMessage
        : styles.systemMessage;

  const bubbleClass =
    message.role === 'user'
      ? styles.userBubble
      : message.role === 'assistant'
        ? styles.assistantBubble
        : styles.systemBubble;

  return (
    <div className={`${styles.message} ${roleClass}`}>
      <span className={styles.roleLabel}>{message.role}</span>
      <div className={`${styles.bubble} ${bubbleClass}`}>
        {message.content}
        {message.isStreaming && <span className={styles.streamingIndicator} />}
      </div>
      <span className={styles.timestamp}>{formatTime(message.timestamp)}</span>
    </div>
  );
}

export function ConversationPanel() {
  const system = useSystem();
  const messages = useStore(system.chatStore, (s) => s.messages);
  const agent = useStore(system.chatStore, (s) => s.agent);
  const isStreaming = useStore(system.chatStore, (s) => s.isStreaming);
  const inputValue = useStore(system.chatStore, (s) => s.inputValue);
  const setInputValue = useStore(system.chatStore, (s) => s.setInputValue);
  const clearMessages = useStore(system.chatStore, (s) => s.clearMessages);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !agent || isStreaming) {
      return;
    }

    system.chatStore.getState().setInputValue('');

    // Publish the user message — the AI subsystem adds it to
    // memory which fires listeners that sync to the chat store.
    system.pubsub.publish('chat:userMessage', {
      content: trimmed
    });
  }, [inputValue, agent, isStreaming, system]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInputChange = useCallback(
    (e: Event) => {
      const target = e.target as HTMLInputElement;
      setInputValue(target.value);
    },
    [setInputValue]
  );

  if (!agent) {
    return (
      <BasePanel>
        <div className={styles.container}>
          <div className={styles.noAgent}>
            <p>No agent connected.</p>
            <p>
              Use the <strong>Setup UI</strong> node to connect an agent to this
              panel.
            </p>
          </div>
        </div>
      </BasePanel>
    );
  }

  return (
    <BasePanel>
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Conversation</h3>
          <div className={styles.headerActions}>
            <VscodeButton
              secondary
              onClick={clearMessages}
              title="Clear messages"
            >
              <Icon slot="start">
                <Trash />
              </Icon>
            </VscodeButton>
          </div>
        </div>

        <div className={styles.messageList}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <VscodeTextfield
            className={styles.textInput}
            placeholder={
              isStreaming ? 'Waiting for response...' : 'Type a message...'
            }
            value={inputValue}
            onInput={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <VscodeButton
            onClick={handleSend}
            disabled={isStreaming || !inputValue.trim()}
            title="Send"
          >
            <Icon slot="start">
              <SendDiagonal />
            </Icon>
          </VscodeButton>
        </div>
      </div>
    </BasePanel>
  );
}
