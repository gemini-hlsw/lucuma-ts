import { Logger, type LogLevel } from 'graphql-yoga';

const logLevels = ['trace', 'debug', 'info', 'warn', 'error'] satisfies LogLevel[];

function parseLogLevel(value: string | undefined): LogLevel | false {
  if (value === 'silent') return false;
  return logLevels.find((level) => level === value) ?? 'info';
}

const logLevel = process.env.DEBUG === '1' ? 'debug' : parseLogLevel(process.env.LOG_LEVEL);

export const log = new Logger({ level: logLevel, prefix: `(${process.pid}): ` });

/** Logger that writes nothing, for tests. */
export const silentLog = new Logger({ level: false });
