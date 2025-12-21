/**
 * Structured logging utility
 *
 * Provides log levels and structured output for production.
 * In development, uses console methods.
 * In production, can be extended to use external logging services.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment
function getMinLogLevel(): number {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  return LOG_LEVELS[level || 'info'] ?? LOG_LEVELS.info;
}

// Check if we're in production
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Sanitize sensitive data from logs
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['privateKey', 'secret', 'password', 'apiKey', 'token', 'authorization'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Format log entry
function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
  if (entry.context && Object.keys(entry.context).length > 0) {
    return `${base} ${JSON.stringify(sanitize(entry.context))}`;
  }
  return base;
}

// Core log function
function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const minLevel = getMinLogLevel();
  if (LOG_LEVELS[level] < minLevel) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: context ? sanitize(context) : undefined,
  };

  if (isProduction()) {
    // In production, output structured JSON
    console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
  } else {
    // In development, use formatted output
    console[level === 'debug' ? 'log' : level](formatEntry(entry));
  }
}

/**
 * Logger with namespace prefix
 */
export function createLogger(namespace: string) {
  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      log('debug', `[${namespace}] ${message}`, context),
    info: (message: string, context?: Record<string, unknown>) =>
      log('info', `[${namespace}] ${message}`, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      log('warn', `[${namespace}] ${message}`, context),
    error: (message: string, context?: Record<string, unknown>) =>
      log('error', `[${namespace}] ${message}`, context),
  };
}

// Pre-configured loggers for common modules
export const executeLogger = createLogger('Execute');
export const zkmlLogger = createLogger('zkML');
export const complianceLogger = createLogger('Compliance');
export const paymentLogger = createLogger('Payment');
