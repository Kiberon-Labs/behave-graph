/* eslint-disable no-console */

import { EventEmitter } from '../Events/EventEmitter.js';
import type { LogSeverity } from '../index.js';

export const LogLevel = {
  Verbose: 0,
  Info: 1,
  Warning: 2,
  Error: 3
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export function logSeverityToLevel(severity: LogSeverity) {
  switch (severity) {
    case 'verbose':
      return LogLevel.Verbose;
    case 'info':
      return LogLevel.Info;
    case 'warning':
      return LogLevel.Warning;
    case 'error':
      return LogLevel.Error;
  }
}
export const PrefixStyle = {
  None: 0,
  Time: 1
} as const;

export type PrefixStyle = (typeof PrefixStyle)[keyof typeof PrefixStyle];

export type LogMessage = { severity: LogSeverity; text: string };

export class Logger {
  static logLevel: LogLevel = LogLevel.Info;
  static prefixStyle: PrefixStyle = PrefixStyle.None;

  public static readonly onLog = new EventEmitter<LogMessage>();

  static {
    const prefix = (): string => {
      switch (Logger.prefixStyle) {
        case PrefixStyle.None:
          return '';
        case PrefixStyle.Time:
          return new Date().toLocaleTimeString().padStart(11, '0') + ' ';
      }
    };

    Logger.onLog.addListener((logMessage: LogMessage) => {
      if (Logger.logLevel > logSeverityToLevel(logMessage.severity)) return;
      console.log(prefix() + logMessage.text);
    });
  }

  static log(severity: LogSeverity, text: string) {
    this.onLog.emit({ severity, text });
  }

  static verbose(text: string) {
    this.onLog.emit({ severity: 'verbose', text });
  }

  static info(text: string) {
    this.onLog.emit({ severity: 'info', text });
  }

  static warning(text: string) {
    this.onLog.emit({ severity: 'warning', text });
  }

  static error(text: string) {
    this.onLog.emit({ severity: 'error', text });
  }
}
