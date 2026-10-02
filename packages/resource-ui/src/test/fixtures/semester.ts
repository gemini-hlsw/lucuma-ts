import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';
import type { PublishedSemestersQuery, SemesterScheduleQuery, SemesterScheduleQueryVariables } from '@gql/gen/graphql';
import { PUBLISHED_SEMESTERS_QUERY, SEMESTER_SCHEDULE_QUERY } from '@gql/resource';

import { addDays } from '@/domain/semester';
import { SITE_NAMES } from '@/domain/types';

import { overNights } from './blocks';

export type PublishedSemesterRow = PublishedSemestersQuery['publishedSemesters'][number];

/** Semester A's evenings run 1 February to 31 July, B's 1 August to 31 January; the API labels nights by their end. */
const semesterNights = (semester: string): PublishedSemesterRow['nights'] => {
  const year = Number(semester.slice(0, 4));
  const [start, end] = semester.endsWith('A')
    ? [`${year}-02-02`, `${year}-08-02`]
    : [`${year}-08-02`, `${year + 1}-02-02`];
  return { __typename: 'DateInterval', start, end };
};

export const publishedSemester = ({
  site,
  semester,
  ...overrides
}: Pick<PublishedSemesterRow, 'site' | 'semester'> &
  Partial<Omit<PublishedSemesterRow, '__typename' | 'site' | 'semester'>>): PublishedSemesterRow => ({
  __typename: 'PublishedSemester',
  site,
  semester,
  title: `${SITE_NAMES[site]} Semester ${semester}`,
  version: null,
  demo: false,
  nights: semesterNights(semester),
  holidays: [],
  moonEvents: [],
  ...overrides,
});

export const publishedSemesters = (
  ...semesters: PublishedSemesterRow[]
): MockedResponseOf<typeof PUBLISHED_SEMESTERS_QUERY> => ({
  request: { query: PUBLISHED_SEMESTERS_QUERY },
  result: { data: { publishedSemesters: semesters } },
});

/** The window the page asks for: every observing night the semester publishes. */
export const semesterWindow = ({ site, nights }: PublishedSemesterRow): SemesterScheduleQueryVariables => {
  const { start, end } = overNights(site, nights.start, addDays(nights.end, -1));
  return { site, interval: { start, end } };
};

/** Pass a semester to answer the window its page asks for, or explicit variables to pin that window. */
export const semesterSchedule = (
  window: PublishedSemesterRow | SemesterScheduleQueryVariables,
  blocks: Partial<SemesterScheduleQuery> = {},
): MockedResponseOf<typeof SEMESTER_SCHEDULE_QUERY> => ({
  request: {
    query: SEMESTER_SCHEDULE_QUERY,
    variables: 'nights' in window ? semesterWindow(window) : window,
  },
  result: {
    data: {
      instrumentAvailability: [],
      telescopeAvailability: [],
      tooSupport: [],
      telescopeMode: [],
      ...blocks,
    },
  },
});

/** The window the finders ask for: the site's whole record. Pass one site's semesters in date order. */
export const siteSpan = (
  first: PublishedSemesterRow,
  ...rest: PublishedSemesterRow[]
): SemesterScheduleQueryVariables => {
  const last = rest.at(-1) ?? first;
  return {
    site: first.site,
    interval: { start: semesterWindow(first).interval.start, end: semesterWindow(last).interval.end },
  };
};
