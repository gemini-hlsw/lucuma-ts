import { afterEach, beforeEach } from 'vitest';

// The warning MockLink logs for an unanswered operation. Nothing else reports it.
const MOCK_LINK_MISS = 'No more mocked responses';

const unanswered: string[] = [];
let recording = false;

/** Starts recording unanswered operations. Safe to call more than once. */
function recordUnansweredQueries(): void {
  if (recording) return;
  recording = true;
  const warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const [message] = args;
    if (typeof message === 'string' && message.startsWith(MOCK_LINK_MISS)) unanswered.push(message);
    warn(...args);
  };
}

/** Returns and clears the unanswered operations recorded since the last call. */
export const takeUnansweredQueries = (): string[] => unanswered.splice(0);

/**
 * Fails each test with an unanswered operation. To allow one, call
 * `takeUnansweredQueries` before the test ends.
 */
export function failOnUnansweredQueries(): void {
  recordUnansweredQueries();
  // vitest-browser-react unmounts the previous tree in its beforeEach, after the afterEach below.
  // Those late queries would fail this test, so this hook runs after it and drops them.
  beforeEach(() => {
    takeUnansweredQueries();
  });
  afterEach(() => {
    const missed = takeUnansweredQueries();
    if (missed.length > 0) throw new Error(`A query had no mocked response:\n${missed.join('\n\n')}`);
  });
}
