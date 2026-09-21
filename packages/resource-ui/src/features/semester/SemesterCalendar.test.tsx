/*
 * The calendar's height is rem so a reader's font-size setting can grow it, on the inference that
 * react-big-calendar resolves that height like any other CSS length. Nothing else checks that the
 * inference holds - this renders the real component and reads the DOM height back.
 */
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { render as renderBare } from 'vitest-browser-react';

import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { Mounting, PublishedSemester } from '@/domain/types';
import { ROOT_FONT_SIZE } from '@/test/styleProbe';

import { SemesterCalendar } from './SemesterCalendar';

const render = async (element: ReactElement) => renderBare(<MemoryRouter>{element}</MemoryRouter>);

const night = (label: string) => observingNightInterval('GS', label);
const MOUNTINGS: readonly Mounting[] = [
  {
    id: 'ghost',
    instrument: 'GHOST',
    publishedName: 'GHOST',
    usage: 'SCIENCE',
    port: 1,
    place: null,
    note: null,
    interval: { start: night('2026-08-08').start, end: night('2026-09-01').end },
  },
];

const timeline = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  mountings: MOUNTINGS,
  closures: [],
});

const semester: PublishedSemester = {
  site: 'GS',
  semester: '2026B',
  title: '2026B',
  version: null,
  demo: false,
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  holidays: [],
  moonEvents: [],
};

const calendarHeight = (container: HTMLElement): number =>
  container.querySelector('.rbc-calendar')?.getBoundingClientRect().height ?? 0;

describe(SemesterCalendar, () => {
  afterEach(() => {
    document.documentElement.style.fontSize = '';
  });

  it("grows the calendar's own height with the reader's root font size", async () => {
    document.documentElement.style.fontSize = ROOT_FONT_SIZE;
    const base = await render(
      <SemesterCalendar timeline={timeline} semester={semester} site="GS" mountings={MOUNTINGS} closures={[]} />,
    );
    // Guarded non-empty first, so a chart that never rendered cannot pass as merely "the right ratio".
    await expect.poll(() => calendarHeight(base.container)).toBeGreaterThan(0);
    const baseHeight = calendarHeight(base.container);

    document.documentElement.style.fontSize = '32px';
    const doubled = await render(
      <SemesterCalendar timeline={timeline} semester={semester} site="GS" mountings={MOUNTINGS} closures={[]} />,
    );
    await expect.poll(() => calendarHeight(doubled.container)).toBeGreaterThan(0);
    expect(calendarHeight(doubled.container)).toBeCloseTo(baseHeight * 2, 0);
  });
});
