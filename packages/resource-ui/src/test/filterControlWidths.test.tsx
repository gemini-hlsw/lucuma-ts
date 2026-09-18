/*
 * WCAG 1.4.12: a box held to a literal pixel width while its own text is set in rem lets a reader's
 * font-size setting outgrow the box before the text does. PrimeReact's `.p-dropdown-label` is what
 * actually clips (`overflow: hidden; text-overflow: ellipsis`), and `showClear` puts an icon there
 * only once a value is selected, eating into the room the label gets - a placeholder-state assertion
 * would pass on a box too narrow for its own selected value. So every dropdown case here opens the
 * real control and picks its own longest rendered option, never the empty placeholder.
 *
 * A pixel budget spent in the wrong face measures nothing, so this file loads the app's styling for
 * its font stack, as SemesterTimeline.test.tsx and labelAdvance.test.ts do.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import { ApolloLink } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';
import type { PublishedSemestersQuery } from '@gql/gen/graphql';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LocatorSelectors } from 'vitest/browser';
import { render as renderBare } from 'vitest-browser-react';

import ComponentsPage from '@/app/pages/ComponentsPage';
import InstrumentsPage from '@/app/pages/InstrumentsPage';
import SemesterPage from '@/app/pages/SemesterPage';
import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { Mounting, PublishedSemester } from '@/domain/types';
import { SemesterCalendar } from '@/features/semester/SemesterCalendar';
import { openDropdown, selectDropdownOption } from '@/test/helpers';
import { createMockApollo } from '@/test/mockClient';
import { renderApp } from '@/test/renderApp';
import { ROOT_FONT_SIZE } from '@/test/styleProbe';

/** The reader's default and WCAG 1.4.4's 200% checkpoint - the two points a rem box has to hold at. */
const ROOTS = [ROOT_FONT_SIZE, '32px'] as const;

beforeAll(() => {
  // The lucuma-ui theme carries the font stack and is scoped under `.dark`, as `main.tsx` scopes it.
  document.documentElement.classList.add('dark');
});

afterEach(() => {
  document.documentElement.style.fontSize = '';
});

/** Opens `label`, reads every rendered option, selects whichever is longest, and leaves it chosen. */
async function selectLongestOption(sut: LocatorSelectors, label: string): Promise<void> {
  await openDropdown(sut, label);
  const longest = [...document.querySelectorAll('[role="option"]')]
    .map((option) => option.textContent ?? '')
    .reduce((a, b) => (b.length > a.length ? b : a));
  await openDropdown(sut, label); // the panel is open; a second click is how the helper closes it
  await selectDropdownOption(sut, label, longest);
}

/** The element PrimeReact actually clips text against - never the `.p-dropdown` wrapper around it. */
function dropdownLabelBox(sut: LocatorSelectors, controlLabel: string): HTMLElement {
  const wrapper = sut.getByLabelText(controlLabel, { exact: true }).element().closest('.p-dropdown');
  const label = wrapper?.querySelector('.p-dropdown-label');
  if (!(label instanceof HTMLElement)) {
    throw new Error(`no .p-dropdown-label under the "${controlLabel}" control`);
  }
  return label;
}

function expectFits(box: HTMLElement): void {
  expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
}

const GS_SEMESTER_WITH_DEMO: PublishedSemestersQuery = {
  publishedSemesters: [
    {
      __typename: 'PublishedSemester',
      site: 'GS',
      semester: '2025B',
      title: 'Gemini South Semester 2025B',
      version: null,
      demo: false,
      holidays: [],
      nights: { __typename: 'DateInterval', start: '2025-08-02', end: '2026-02-02' },
      moonEvents: [],
    },
    {
      __typename: 'PublishedSemester',
      site: 'GS',
      semester: '2026B',
      title: 'Gemini South Semester 2026B',
      version: null,
      demo: true,
      holidays: [],
      nights: { __typename: 'DateInterval', start: '2026-08-02', end: '2027-02-02' },
      moonEvents: [],
    },
  ],
};

/** The "(demo)" suffix, so the semester picker's own longest option is worth measuring at all. */
const withDemoSemester = () =>
  createMockApollo(
    new ApolloLink((operation, forward) =>
      operation.operationName === 'PublishedSemesters'
        ? new Observable((observer) => {
            observer.next({ data: GS_SEMESTER_WITH_DEMO });
            observer.complete();
          })
        : forward(operation),
    ),
  );

describe('the filter and page controls a reader can grow past their own box', () => {
  it.each(ROOTS)(
    'keeps the Components Search field showing its own placeholder-length value at a %s root',
    async (root) => {
      document.documentElement.style.fontSize = root;
      const screen = await renderApp({
        element: <ComponentsPage />,
        route: '/components?site=GS&semester=2025B&night=2025-10-15',
      });
      await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

      const input = screen.getByLabelText('Search', { exact: true }).element() as HTMLInputElement;
      await screen.getByLabelText('Search', { exact: true }).fill(input.placeholder);
      expectFits(input);
    },
  );

  it.each(ROOTS)(
    'keeps the Instruments Search field showing its own placeholder-length value at a %s root',
    async (root) => {
      document.documentElement.style.fontSize = root;
      const screen = await renderApp({
        element: <InstrumentsPage />,
        route: '/instruments?site=GN&semester=2026B&night=2026-09-26',
      });
      await expect.element(screen.getByText('GNIRS')).toBeVisible();

      const input = screen.getByLabelText('Search', { exact: true }).element() as HTMLInputElement;
      await screen.getByLabelText('Search', { exact: true }).fill(input.placeholder);
      expectFits(input);
    },
  );

  it.each(ROOTS)(
    'keeps the Components Instrument filter showing its own longest selected option at a %s root',
    async (root) => {
      document.documentElement.style.fontSize = root;
      const screen = await renderApp({
        element: <ComponentsPage />,
        route: '/components?site=GS&semester=2025B&night=2025-10-15',
      });
      await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

      await selectLongestOption(screen, 'Instrument');
      expectFits(dropdownLabelBox(screen, 'Instrument'));
    },
  );

  it.each(ROOTS)(
    'keeps the Components Type filter showing its own longest selected option at a %s root',
    async (root) => {
      document.documentElement.style.fontSize = root;
      const screen = await renderApp({
        element: <ComponentsPage />,
        route: '/components?site=GS&semester=2025B&night=2025-10-15',
      });
      await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

      // The reported case: "Disperser (10)" is the longest Type option in this fixture.
      await selectLongestOption(screen, 'Type');
      expectFits(dropdownLabelBox(screen, 'Type'));
    },
  );

  it.each(ROOTS)(
    'keeps the Instruments Location filter showing its own longest selected option at a %s root',
    async (root) => {
      document.documentElement.style.fontSize = root;
      const screen = await renderApp({
        element: <InstrumentsPage />,
        route: '/instruments?site=GN&semester=2026B&night=2026-09-26',
      });
      await expect.element(screen.getByText('GNIRS')).toBeVisible();

      await selectLongestOption(screen, 'Location');
      expectFits(dropdownLabelBox(screen, 'Location'));
    },
  );

  it.each(ROOTS)('keeps the Semester picker showing its own longest selected option at a %s root', async (root) => {
    document.documentElement.style.fontSize = root;
    const screen = await renderApp({
      element: <SemesterPage />,
      route: '/semester?site=GS&semester=2025B',
      mock: withDemoSemester(),
    });
    await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();

    await selectLongestOption(screen, 'Semester');
    expectFits(dropdownLabelBox(screen, 'Semester'));
  });

  it.each(ROOTS)(
    'keeps the calendar Month picker showing its own longest selected option at a %s root',
    async (root) => {
      const renderRouted = async (element: ReactElement) => renderBare(<MemoryRouter>{element}</MemoryRouter>);
      const night = (label: string) => observingNightInterval('GS', label);
      const mountings: readonly Mounting[] = [
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
      // Spans August and September, so "September 2026" - the reported worst-case label - is an option.
      const timeline = buildSemesterTimeline({
        site: 'GS',
        firstNight: '2026-08-02',
        lastNight: '2026-09-01',
        mountings,
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

      document.documentElement.style.fontSize = root;
      const screen = await renderRouted(
        <SemesterCalendar timeline={timeline} semester={semester} site="GS" mountings={mountings} closures={[]} />,
      );
      await expect.element(screen.getByLabelText('Month', { exact: true })).toBeVisible();

      await selectLongestOption(screen, 'Month');
      expectFits(dropdownLabelBox(screen, 'Month'));
    },
  );

  it("lets FilterField's own column shrink so a clamped control's max-w-full is not inert", async () => {
    // Narrower than any one control's own rem width, so the row can only avoid overflowing this
    // 220px `overflow-hidden` stand-in for `.xp-shell` by letting `max-w-full` actually shrink one.
    const screen = await renderApp({
      element: (
        <div style={{ width: '220px', overflow: 'hidden' }} data-testid="squeeze">
          <ComponentsPage />
        </div>
      ),
      route: '/components?site=GS&semester=2025B&night=2025-10-15',
    });
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

    await selectLongestOption(screen, 'Type');

    const squeeze = screen.getByTestId('squeeze').element() as HTMLElement;
    expect(squeeze.scrollWidth).toBeLessThanOrEqual(squeeze.clientWidth);
  });
});
