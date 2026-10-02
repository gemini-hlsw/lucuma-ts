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
