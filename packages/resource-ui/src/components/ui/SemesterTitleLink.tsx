/** Set on the current query string, so the rest of the selection survives the jump. */
import type { JSX } from 'react';
import { Link, useSearchParams } from 'react-router';

import type { PublishedSemester } from '@/domain/types';

export function SemesterTitleLink({ semester }: { semester: PublishedSemester }): JSX.Element {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set('site', semester.site);
  next.set('semester', semester.semester);

  return (
    <Link
      to={{ pathname: '/semester', search: `?${next.toString()}` }}
      className="underline decoration-dotted underline-offset-2 hover:text-foreground"
    >
      {semester.title}
    </Link>
  );
}
