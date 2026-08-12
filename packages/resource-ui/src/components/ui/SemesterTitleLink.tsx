/**
 * The subtitle's way back up: the published title as a link to its semester
 * page - the reverse of the calendar's click-through into a night.
 *
 * Site and semester are set on the current query string rather than a fresh
 * one, so the rest of the selection (the night itself) survives the jump the
 * same way it survives the jump down into a night (`useOpenNight`).
 */
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
