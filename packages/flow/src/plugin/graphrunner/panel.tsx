import React, { useState } from 'react';
import { useStore } from 'zustand';
import type { System } from '../../system/system';
import type { AuthCredentials } from './types';
import {
  VscodeButton,
  VscodeTextfield,
  VscodeCheckbox,
  VscodeSingleSelect,
  VscodeOption,
  VscodeLabel,
  VscodeBadge,
  VscodeTree,
  VscodeTreeItem,
  VscodeCollapsible
} from '@vscode-elements/react-elements';
import styles from './styles.module.css';

interface GraphRunnerPanelProps {
  system: System;
}

export const GraphRunnerPanel: React.FC<GraphRunnerPanelProps> = ({
  system
}) => {
  const store = system.runner.store;

  const connectionState = useStore(store, (state) => state.connectionState);
  const connectionConfig = useStore(store, (state) => state.connectionConfig);
  const connectionInfo = useStore(store, (state) => state.connectionInfo);
  const error = useStore(store, (state) => state.error);
  const serverVariables = useStore(store, (state) => state.serverVariables);
  const serverEvents = useStore(store, (state) => state.serverEvents);
  const nodeTypes = useStore(store, (state) => state.nodeTypes);
  const messageActivity = useStore(store, (state) => state.messageActivity);
  const clearLogsOnRun = useStore(store, (state) => state.clearLogsOnRun);
  const clearTracesOnRun = useStore(store, (state) => state.clearTracesOnRun);
  const enableTracing = useStore(store, (state) => state.enableTracing);

  const icons = useStore(system.legendStore, (state) => state.icons);
  const defaultIcon = useStore(
    system.legendStore,
    (state) => state.defaultIcon
  );

  const [url, setUrl] = useState(connectionConfig.url);
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'apiKey'>(
    connectionConfig.auth.type
  );
  const [authToken, setAuthToken] = useState('');
  const [autoReconnect, setAutoReconnect] = useState(
    connectionConfig.autoReconnect
  );

  const handleConnect = async () => {
    const auth: AuthCredentials =
      authType === 'bearer'
        ? { type: 'bearer', token: authToken }
        : authType === 'apiKey'
          ? { type: 'apiKey', key: authToken }
          : { type: 'none' };

    store.getState().setConnectionConfig({ url, auth, autoReconnect });

    await system.runner.connect();
  };

  const handleDisconnect = async () => {
    await system.runner.disconnect();
  };

  const handleRefreshMetadata = async () => {
    await system.runner.refreshMetadata();
  };

  const handleClearMessages = () => {
    store.getState().clearMessageActivity();
  };

  const isConnected = connectionState === 'connected';
  const isConnecting =
    connectionState === 'connecting' || connectionState === 'authenticating';

  return (
    <div className={styles.panel}>
      {/* Scrollable Content Container */}
      <div className={styles.scrollContainer}>
        <h3 className={styles.title}>
          Remote Graph Runner
          <VscodeBadge variant="tab-header-counter">
            {isConnected ? 'Connected' : 'Disconnected'}
          </VscodeBadge>
        </h3>

        <div>
          {/* Connection Form */}
          <VscodeCollapsible heading="Connection Settings">
            <div className={styles.connectionForm}>
              <div>
                <VscodeLabel>Server URL</VscodeLabel>
                <VscodeTextfield
                  value={url}
                  onChange={(e: any) => setUrl(e.target.value)}
                  placeholder="ws://localhost:8080"
                  disabled={isConnected || isConnecting}
                  className={styles.formField}
                />
              </div>

              <div>
                <VscodeLabel>Authentication</VscodeLabel>
                <VscodeSingleSelect
                  value={authType}
                  onChange={(e: any) =>
                    setAuthType(e.target.value as 'none' | 'bearer' | 'apiKey')
                  }
                  disabled={isConnected || isConnecting}
                  className={styles.formField}
                >
                  <VscodeOption value="none">None</VscodeOption>
                  <VscodeOption value="bearer">Bearer Token</VscodeOption>
                  <VscodeOption value="apiKey">API Key</VscodeOption>
                </VscodeSingleSelect>
              </div>

              {authType !== 'none' && (
                <div>
                  <VscodeLabel>
                    {authType === 'bearer' ? 'Token' : 'API Key'}
                  </VscodeLabel>
                  <VscodeTextfield
                    type="password"
                    value={authToken}
                    onChange={(e: any) => setAuthToken(e.target.value)}
                    placeholder={
                      authType === 'bearer'
                        ? 'Enter bearer token'
                        : 'Enter API key'
                    }
                    disabled={isConnected || isConnecting}
                    className={styles.formField}
                  />
                </div>
              )}

              <VscodeCheckbox
                checked={autoReconnect}
                onChange={(e: any) => setAutoReconnect(e.target.checked)}
                disabled={isConnected || isConnecting}
              >
                Auto-reconnect
              </VscodeCheckbox>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Execution Preferences</h4>
                <VscodeCheckbox
                  checked={enableTracing}
                  onChange={(e: any) =>
                    store.getState().setEnableTracing(e.target.checked)
                  }
                >
                  Enable execution tracing
                </VscodeCheckbox>
                <VscodeCheckbox
                  checked={clearLogsOnRun}
                  onChange={(e: any) =>
                    store.getState().setClearLogsOnRun(e.target.checked)
                  }
                >
                  Clear logs on new run
                </VscodeCheckbox>
                <VscodeCheckbox
                  checked={clearTracesOnRun}
                  onChange={(e: any) =>
                    store.getState().setClearTracesOnRun(e.target.checked)
                  }
                >
                  Clear traces on new run
                </VscodeCheckbox>
              </div>

              <div className={styles.buttonGroup}>
                {!isConnected && (
                  <VscodeButton
                    onClick={handleConnect}
                    disabled={isConnecting || !url}
                    className={styles.button}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </VscodeButton>
                )}
                {isConnected && (
                  <>
                    <VscodeButton
                      onClick={handleDisconnect}
                      className={styles.button}
                    >
                      Disconnect
                    </VscodeButton>
                    <VscodeButton
                      onClick={handleRefreshMetadata}
                      className={styles.button}
                    >
                      Refresh
                    </VscodeButton>
                  </>
                )}
              </div>
            </div>
          </VscodeCollapsible>

          {/* Error Display */}
          {error && (
            <div className={styles.errorBox}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Connection Info */}
          {isConnected && (
            <VscodeCollapsible heading="Status">
              <div className={styles.infoBox}>
                <div>
                  <strong>Status:</strong> Connected
                </div>
                {connectionInfo.serverId && (
                  <div className={styles.infoField}>
                    <strong>Server:</strong> {connectionInfo.serverId}
                  </div>
                )}
                {connectionInfo.sessionId && (
                  <div className={styles.infoField}>
                    <strong>Session:</strong> {connectionInfo.sessionId}
                  </div>
                )}
                {connectionInfo.userId && (
                  <div className={styles.infoField}>
                    <strong>User:</strong> {connectionInfo.userId}
                  </div>
                )}
                {connectionInfo.capabilities && (
                  <div className={styles.infoField}>
                    <strong>Capabilities:</strong>{' '}
                    {Object.entries(connectionInfo.capabilities)
                      .filter(([_, v]) => v === true)
                      .map(([k]) => k)
                      .join(', ')}
                  </div>
                )}
              </div>
            </VscodeCollapsible>
          )}
          {isConnected && (
            <>
              <VscodeCollapsible heading="Variables">
                <VscodeBadge slot="decorations">
                  {serverVariables.length}
                </VscodeBadge>
                <VscodeTree>
                  {serverVariables.map((variable) => {
                    const Icon = icons[variable.valueTypeName] ?? defaultIcon;
                    const IconComponent = Icon as React.FC<{ slot?: string }>;
                    return (
                      <VscodeTreeItem key={variable.name}>
                        <IconComponent slot="icon-leaf" />
                        <span>{variable.name}</span>
                      </VscodeTreeItem>
                    );
                  })}
                </VscodeTree>
              </VscodeCollapsible>

              <VscodeCollapsible heading="Events">
                <VscodeBadge slot="decorations">
                  {serverEvents.length}
                </VscodeBadge>

                <div className={styles.tabPanelGap}>
                  {serverEvents.length === 0 ? (
                    <p className={styles.emptyMessage}>
                      No server events available
                    </p>
                  ) : (
                    <VscodeTree>
                      {serverEvents.map((event) => (
                        <VscodeTreeItem key={event.name}>
                          <span className={styles.treeItemTitle}>
                            {event.name}
                          </span>
                          <VscodeTreeItem key={event.name}>
                            <span slot="description">{event.description}</span>
                            {event.payloadSchema != null ? (
                              <pre className={styles.codeBlock}>
                                {JSON.stringify(event.payloadSchema, null, 2)}
                              </pre>
                            ) : null}
                          </VscodeTreeItem>
                        </VscodeTreeItem>
                      ))}
                    </VscodeTree>
                  )}
                </div>
              </VscodeCollapsible>

              <VscodeCollapsible heading="Nodes">
                <VscodeBadge slot="decorations">{nodeTypes.length}</VscodeBadge>
                <div className={styles.tabPanelGap}>
                  {nodeTypes.length === 0 ? (
                    <p className={styles.emptyMessage}>
                      No node types available
                    </p>
                  ) : (
                    <VscodeTree>
                      {nodeTypes.map((node) => (
                        <VscodeTreeItem>
                          {node.type}

                          <span slot="description">{node.category}</span>
                        </VscodeTreeItem>
                      ))}
                    </VscodeTree>
                  )}
                </div>
              </VscodeCollapsible>
              <VscodeCollapsible heading="Message Activity">
                <VscodeBadge slot="decorations">
                  {messageActivity.length}
                </VscodeBadge>
                <div className={styles.tabPanelGapLarge}>
                  <div className={styles.messagesToolbar}>
                    <div className={styles.messagesCount}>
                      {messageActivity.length} message
                      {messageActivity.length !== 1 ? 's' : ''}
                    </div>
                    {messageActivity.length > 0 && (
                      <VscodeButton onClick={handleClearMessages}>
                        Clear
                      </VscodeButton>
                    )}
                  </div>
                  {messageActivity.length === 0 ? (
                    <p className={styles.emptyMessage}>No messages yet</p>
                  ) : (
                    <div className={styles.tabPanelGap}>
                      {messageActivity.map((activity) => {
                        const time = new Date(
                          activity.timestamp
                        ).toLocaleTimeString();
                        const directionColor =
                          activity.direction === 'sent'
                            ? 'var(--vscode-gitDecoration-modifiedResourceForeground)'
                            : 'var(--vscode-gitDecoration-addedResourceForeground)';

                        return (
                          <div key={activity.id} className={styles.messageCard}>
                            <div className={styles.messageHeader}>
                              <div className={styles.messageDirection}>
                                <span
                                  className={styles.messageDirectionIcon}
                                  style={{ color: directionColor }}
                                >
                                  {activity.direction === 'sent' ? '→' : '←'}
                                </span>
                                <span className={styles.messageType}>
                                  {activity.message.type}
                                </span>
                              </div>
                              <span className={styles.messageTime}>{time}</span>
                            </div>
                            <pre className={styles.messageContent}>
                              {JSON.stringify(activity.message, null, 2)}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </VscodeCollapsible>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
