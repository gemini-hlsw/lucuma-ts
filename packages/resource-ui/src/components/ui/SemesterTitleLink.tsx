import type { JSX } from 'react';
import { Link, useSearchParams } from 'react-router';

import { carrySelection, searchString } from '@/app/carriedSelection';
import type { PublishedSemester } from '@/domain/types';

export function SemesterTitleLink({ semester }: { semester: PublishedSemester }): JSX.Element {
  const [params] = useSearchParams();
  const next = carrySelection(params);
  next.set('site', semester.site);
  next.set('semester', semester.semester);

  return (
    <Link
      to={{ pathname: '/semester', search: searchString(next) }}
      className="underline decoration-dotted underline-offset-2 hover:text-foreground"
    >
      {semester.title}
    </Link>
  );
}
