/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { createLogger, type LogLevel, type YogaLogger } from 'graphql-yoga';

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const timePrefix = () => {
  const now = new Date();
  return `[${timeFormatter.format(now)}.${String(now.getMilliseconds()).padStart(3, '0')}]`;
};

const pidPrefix = `(${process.pid})`;

const logLevel = process.env.DEBUG === '1' ? 'debug' : ((process.env.LOG_LEVEL as LogLevel) ?? 'info');
const baseLog = createLogger(logLevel);

export const log: YogaLogger = {
  debug: (...args) => {
    baseLog.debug(timePrefix(), pidPrefix + ':', ...args);
  },
  info: (...args) => {
    baseLog.info(timePrefix(), pidPrefix + ':', ...args);
  },
  warn: (...args) => {
    baseLog.warn(timePrefix(), pidPrefix + ':', ...args);
  },
  error: (...args) => {
    baseLog.error(timePrefix(), pidPrefix + ':', ...args);
  },
};
