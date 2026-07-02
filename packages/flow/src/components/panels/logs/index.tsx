import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Xmark,
  Download,
  TrashSolid,
  WarningCircle,
  InfoCircle,
  InfoCircleSolid,
  WarningCircleSolid,
  ArrowDownCircle,
  ArrowDownCircleSolid,
  Clock,
  ClockSolid
} from 'iconoir-react';
import { VscodeTextfield } from '@vscode-elements/react-elements';
import { useActiveGraph } from '@/system/provider';
import { useStore } from 'zustand';
import clsx from 'clsx';
import { BasePanel } from '../base';
import type { LogSeverity } from '@kiberon-labs/behave-graph';
import styles from './index.module.css';
import { Icon } from '@/components/primitives/icon';

const LEVELS: readonly LogSeverity[] = ['verbose', 'info', 'warning', 'error'];

const LOG_COLORS: Record<LogSeverity, string> = {
  verbose: 'var(--ds-terminal-cyan, #29b8db)',
  info: 'var(--ds-chart-blue, #3794ff)',
  warning: 'var(--ds-warning, #cca700)',
  error: 'var(--ds-error, #f48771)'
};

const IconType: Record<LogSeverity, React.ReactNode> = {
  verbose: <InfoCircleSolid />,
  info: <InfoCircle />,
  warning: <WarningCircle />,
  error: <WarningCircleSolid />
};

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** VS Code style log timestamp: 24h clock with milliseconds. */
const formatTimestamp = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}.${pad(date.getMilliseconds(), 3)}`;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Splits a message into plain/highlighted segments for the active search term. */
const renderMessage = (message: string, term: string): React.ReactNode => {
  if (!term) return message;
  const regex = new RegExp(`(${escapeRegExp(term)})`, 'ig');
  const parts = message.split(regex);
  return parts.map((part, index) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={index} className={styles.highlight}>
        {part}
      </mark>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  );
};

export function LogsPanel() {
  const system = useActiveGraph()!;
  const logs = useStore(system.logsStore, (x) => x.logs);
  const clearLogs = useStore(system.logsStore, (x) => x.clear);

  const [searchText, setSearchText] = React.useState('');
  const [currentSearchTerm, setCurrentSearchTerm] = React.useState('');
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [showTimestamps, setShowTimestamps] = React.useState(true);
  const [selectedLevels, setSelectedLevels] = React.useState<Set<LogSeverity>>(
    new Set(LEVELS)
  );

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [logs, autoScroll]);

  const onSearchChange = useCallback((e: any) => {
    const next = e.target.value as string;
    setSearchText(next);
    // live-filter as the user types, like the VS Code filter box
    setCurrentSearchTerm(next);
  }, []);

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

  const levelCounts = useMemo(() => {
    const counts: Record<LogSeverity, number> = {
      verbose: 0,
      info: 0,
      warning: 0,
      error: 0
    };
    for (const log of logs) counts[log.type]++;
    return counts;
  }, [logs]);

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

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        system.editor.notifications.success('Copied to clipboard');
      });
    },
    [system]
  );

  return (
    <BasePanel>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <div className={styles.searchField}>
            <Search className={styles.searchIcon} width={14} height={14} />
            <VscodeTextfield
              className={styles.searchInput}
              value={searchText}
              placeholder="Filter logs"
              onChange={onSearchChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape') clearSearch();
              }}
            />
            {searchText && (
              <Icon title="Clear filter" onClick={clearSearch}>
                <Xmark width={14} height={14} />
              </Icon>
            )}
          </div>

          <div className={styles.toolbarActions}>
            <Icon
              title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
              className={clsx(autoScroll && styles.actionActive)}
              onClick={() => setAutoScroll((v) => !v)}
            >
              {autoScroll ? <ArrowDownCircleSolid /> : <ArrowDownCircle />}
            </Icon>
            <Icon
              title={showTimestamps ? 'Hide timestamps' : 'Show timestamps'}
              className={clsx(showTimestamps && styles.actionActive)}
              onClick={() => setShowTimestamps((v) => !v)}
            >
              {showTimestamps ? <ClockSolid /> : <Clock />}
            </Icon>
            <Icon title="Export logs" onClick={exportLogs}>
              <Download />
            </Icon>
            <Icon title="Clear logs" onClick={clearLogs}>
              <TrashSolid />
            </Icon>
          </div>
        </div>

        {/* Level filter toggles */}
        <div className={styles.filters}>
          {LEVELS.map((level) => {
            const active = selectedLevels.has(level);
            return (
              <button
                type="button"
                key={level}
                className={clsx(styles.levelChip, !active && styles.levelOff)}
                style={{ ['--chip-color' as string]: LOG_COLORS[level] }}
                onClick={() => toggleLevel(level)}
                aria-pressed={active}
                title={`${active ? 'Hide' : 'Show'} ${level} logs`}
              >
                <span className={styles.levelChipIcon}>{IconType[level]}</span>
                <span className={styles.levelChipLabel}>{level}</span>
                <span className={styles.levelChipCount}>
                  {levelCounts[level]}
                </span>
              </button>
            );
          })}
          <span className={styles.logCount}>
            {filteredLogs.length === logs.length
              ? `${logs.length} logs`
              : `${filteredLogs.length} / ${logs.length} logs`}
          </span>
        </div>
      </div>

      {/* Log list */}
      <div className={styles.logsContainer}>
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            {logs.length === 0
              ? 'No logs to display.'
              : 'No logs match the current filter.'}
          </div>
        ) : (
          <div className={styles.logsList} role="log" aria-live="polite">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className={styles.row}
                data-severity={log.type}
                onDoubleClick={() => copyToClipboard(log.data.message)}
                title="Double-click to copy"
              >
                <span
                  className={styles.rowIcon}
                  style={{ color: LOG_COLORS[log.type] }}
                  aria-label={log.type}
                >
                  {IconType[log.type]}
                </span>
                {showTimestamps && (
                  <time className={styles.rowTime}>
                    {formatTimestamp(log.time)}
                  </time>
                )}
                <span className={styles.rowMessage}>
                  {renderMessage(log.data.message, currentSearchTerm)}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </BasePanel>
  );
}
