// Debug Logger Utility
const DEBUG = true; // Set to false to disable logging

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 500;

const formatTimestamp = (): string => {
  return new Date().toISOString().slice(11, 23);
};

const addToHistory = (entry: LogEntry) => {
  logHistory.push(entry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }
};

export const logger = {
  debug: (category: string, message: string, data?: unknown) => {
    if (!DEBUG) return;
    const entry: LogEntry = { timestamp: formatTimestamp(), level: 'debug', category, message, data };
    addToHistory(entry);
    console.log(`[${entry.timestamp}] [DEBUG] [${category}] ${message}`, data ?? '');
  },

  info: (category: string, message: string, data?: unknown) => {
    const entry: LogEntry = { timestamp: formatTimestamp(), level: 'info', category, message, data };
    addToHistory(entry);
    console.info(`[${entry.timestamp}] [INFO] [${category}] ${message}`, data ?? '');
  },

  warn: (category: string, message: string, data?: unknown) => {
    const entry: LogEntry = { timestamp: formatTimestamp(), level: 'warn', category, message, data };
    addToHistory(entry);
    console.warn(`[${entry.timestamp}] [WARN] [${category}] ${message}`, data ?? '');
  },

  error: (category: string, message: string, data?: unknown) => {
    const entry: LogEntry = { timestamp: formatTimestamp(), level: 'error', category, message, data };
    addToHistory(entry);
    console.error(`[${entry.timestamp}] [ERROR] [${category}] ${message}`, data ?? '');
  },

  // Get log history for debugging
  getHistory: (): LogEntry[] => [...logHistory],

  // Clear log history
  clearHistory: () => {
    logHistory.length = 0;
  },

  // Export logs as text for debugging
  exportLogs: (): string => {
    return logHistory
      .map(e => `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.category}] ${e.message}${e.data ? ' ' + JSON.stringify(e.data) : ''}`)
      .join('\n');
  },
};

// Expose logger to window for debugging in console
if (typeof window !== 'undefined') {
  (window as unknown as { __logger: typeof logger }).__logger = logger;
}
