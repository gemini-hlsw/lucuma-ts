// MockLink's only signal for an operation no mock answers; the query itself then fails without failing the test.
const MOCK_LINK_MISS = 'No more mocked responses';

const unanswered: string[] = [];

export function recordUnansweredQueries(): void {
  const warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const [message] = args;
    if (typeof message === 'string' && message.startsWith(MOCK_LINK_MISS)) unanswered.push(message);
    warn(...args);
  };
}

export const takeUnansweredQueries = (): string[] => unanswered.splice(0);

/** Fails the running test when a query went unanswered, so a missing mock cannot pass as a quiet warning. */
export function assertNoUnansweredQueries(): void {
  const misses = takeUnansweredQueries();
  if (misses.length > 0) throw new Error(`A query had no mocked response:\n${misses.join('\n\n')}`);
}
