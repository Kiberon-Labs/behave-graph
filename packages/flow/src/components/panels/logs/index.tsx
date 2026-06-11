import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Xmark,
  Download,
  TrashSolid,
  WarningCircle,
  InfoCircle,
  InfoCircleSolid,
  WarningCircleSolid
} from 'iconoir-react';
import {
  VscodeTextfield,
  VscodeCheckbox,
  VscodeTree,
  VscodeTreeItem
} from '@vscode-elements/react-elements';
import { useSystem } from '@/system/provider';
import { useStore } from 'zustand';
import { BasePanel } from '../base';
import type { LogSeverity } from '@kiberon-labs/behave-graph';
import styles from './index.module.css';
import { Icon } from '@/components/primitives/icon';

const LOG_COLORS: Record<LogSeverity, string> = {
  verbose: 'var(--vscode-terminal-ansiCyan)',
  info: 'var(--vscode-terminal-ansiBlue)',
  warning: 'var(--vscode-terminal-ansiYellow)',
  error: 'var(--vscode-terminal-ansiRed)'
};

const IconType: Record<LogSeverity, React.ReactNode> = {
  verbose: <InfoCircleSolid />,
  info: <InfoCircle />,
  warning: <WarningCircle />,
  error: <WarningCircleSolid />
};

export function LogsPanel() {
  const system = useSystem();
  const logs = useStore(system.logsStore, (x) => x.logs);
  const clearLogs = useStore(system.logsStore, (x) => x.clear);

  const [searchText, setSearchText] = React.useState('');
  const [currentSearchTerm, setCurrentSearchTerm] = React.useState('');
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [selectedLevels, setSelectedLevels] = React.useState<Set<LogSeverity>>(
    new Set(['verbose', 'info', 'warning', 'error'])
  );

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const containerRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs, autoScroll]);

  const onSearchChange = useCallback((e: any) => {
    setSearchText(e.target.value);
  }, []);

  const handleSearch = useCallback(() => {
    setCurrentSearchTerm(searchText);
  }, [searchText]);

  const clearSearch = useCallback(() => {
    setSearchText('');
    setCurrentSearchTerm('');
  }, []);

  const toggleLevel = useCallback((level: LogSeverity) => {
    setSelectedLevels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  }, []);

  const filteredLogs = useMemo(() => {
    let result = logs.filter((log) => selectedLevels.has(log.type));

    if (currentSearchTerm) {
      const lowerCaseSearchText = currentSearchTerm.toLowerCase();
      result = result.filter((log) => {
        const logDataString = log.data.message.toLowerCase();
        const logTypeString = log.type.toLowerCase();
        return (
          logDataString.includes(lowerCaseSearchText) ||
          logTypeString.includes(lowerCaseSearchText)
        );
      });
    }

    return result;
  }, [logs, currentSearchTerm, selectedLevels]);

  const exportLogs = useCallback(() => {
    const logData = filteredLogs.map((log) => ({
      timestamp: log.time.toISOString(),
      level: log.type,
      message: log.data.message
    }));
    const blob = new Blob([JSON.stringify(logData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const formatLogData = (data: Record<string, unknown> | string) => {
    if (typeof data === 'string') {
      return data;
    }
    return JSON.stringify(data, null, 2);
  };

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        system.notifications.success('Copied to clipboard');
      });
    },
    [system]
  );

  return (
    <BasePanel>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Search Bar */}
        <div className={styles.searchBar}>
          <VscodeTextfield
            className={styles.searchInput}
            value={searchText}
            placeholder="Search logs..."
            onChange={onSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              } else if (e.key === 'Escape') {
                clearSearch();
              }
            }}
          />
          <Icon title="Search" onClick={handleSearch}>
            <Search />
          </Icon>
          {currentSearchTerm && (
            <Icon title="Clear search" onClick={clearSearch}>
              <Xmark />
            </Icon>
          )}
          <Icon title="Export logs" onClick={exportLogs}>
            <Download />
          </Icon>
          <Icon title="Clear all logs" onClick={clearLogs}>
            <TrashSolid />
          </Icon>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <span className={styles.filterLabel}>Filter:</span>
          {(['verbose', 'info', 'warning', 'error'] as LogSeverity[]).map(
            (level) => (
              <VscodeCheckbox
                key={level}
                checked={selectedLevels.has(level)}
                onChange={() => toggleLevel(level)}
              >
                <span
                  className={styles.levelLabel}
                  style={{ color: LOG_COLORS[level] }}
                >
                  {level}
                </span>
              </VscodeCheckbox>
            )
          )}
          <VscodeCheckbox
            checked={autoScroll}
            onChange={(e: any) => setAutoScroll(e.target.checked)}
            className={styles.autoScrollCheckbox}
          >
            <span className={styles.autoScrollLabel}>Auto-scroll</span>
          </VscodeCheckbox>
          <span className={styles.logCount}>
            {filteredLogs.length} of {logs.length} logs
          </span>
        </div>
      </div>

      {/* Logs Container */}
      <div ref={containerRef} className={styles.logsContainer}>
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            {logs.length === 0
              ? 'No logs yet'
              : 'No logs match the current filters'}
          </div>
        ) : (
          <div className={styles.logsList}>
            <VscodeTree>
              {filteredLogs.map((log, index) => (
                <VscodeTreeItem
                  key={index}
                  className={styles.logItem}
                  style={{ borderLeft: `3px solid ${LOG_COLORS[log.type]}` }}
                  onDoubleClick={() =>
                    copyToClipboard(formatLogData(log.data.message))
                  }
                  title="Double-click to copy"
                >
                  <span
                    slot="icon-leaf"
                    className={styles.logBadge}
                    style={{ backgroundColor: LOG_COLORS[log.type] }}
                  >
                    {IconType[log.type]}
                  </span>
                  <div className={styles.logContent}>
                    {formatLogData(log.data.message)}
                  </div>
                  <span slot="description" className={styles.logTimestamp}>
                    {log.time.toLocaleTimeString()}
                  </span>
                </VscodeTreeItem>
              ))}
            </VscodeTree>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </BasePanel>
  );
}
