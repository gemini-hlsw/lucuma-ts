import type { JSX } from 'react';

export interface SessionNoticesProps {
  readonly announcement: string;
}

export function SessionNotices({ announcement }: SessionNoticesProps): JSX.Element {
  return (
    <span role="status" className="sr-only">
      {announcement}
    </span>
  );
}
