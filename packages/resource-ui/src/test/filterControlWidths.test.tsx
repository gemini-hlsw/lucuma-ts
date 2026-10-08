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
import type { InstrumentAvailabilityBlock, PublishedSemester } from '@/domain/types';
import { SemesterCalendar } from '@/features/semester/SemesterCalendar';
import { instrumentAvailabilityBlock } from '@/test/fixtures/blocks';
import { componentBrowser, instrumentComponent } from '@/test/fixtures/components';
import { publishedSemester, publishedSemesters, recentSpan, semesterSchedule } from '@/test/fixtures/semester';
import { nightsFromTonight } from '@/test/fixtures/tonight';
import { openDropdown, selectDropdownOption } from '@/test/helpers';
import { renderWithContext } from '@/test/render';
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

const GS_2025B = publishedSemester({ site: 'GS', semester: '2025B' });
/** The "(demo)" suffix, so the semester picker's own longest option is worth measuring at all. */
const GS_2026B_DEMO = publishedSemester({ site: 'GS', semester: '2026B', demo: true });
const GN_2026B = publishedSemester({ site: 'GN', semester: '2026B' });

/** Two-digit counts, as a real catalog has, so each measured option is as wide as it gets in use. */
const CATALOG = [
  instrumentComponent({ id: 'k-gs-mask-011', componentType: 'FPU', code: 'GS2026B-011', name: 'Mask GS2026B-011' }),
  ...Array.from({ length: 10 }, (_, index) =>
    instrumentComponent({
      id: `k-gs-grating-${index}`,
      componentType: 'DISPERSER',
      code: `G${index}`,
      name: `Grating ${index}`,
    }),
  ),
  ...Array.from({ length: 12 }, (_, index) =>
    instrumentComponent({
      id: `k-gs-filter-${index}`,
      instrument: 'GSAOI',
      code: `F${index}`,
      name: `Filter ${index}`,
    }),
  ),
];

const openComponents = (element: ReactElement) =>
  renderWithContext(element, {
    route: '/components?site=GS',
    mocks: [publishedSemesters(GS_2025B), componentBrowser(recentSpan('GS'), { components: CATALOG })],
  });

const GN_WHOLE = nightsFromTonight('GN', -60, 60);

const openInstruments = () =>
  renderWithContext(<InstrumentsPage />, {
    route: '/instruments?site=GN',
    mocks: [
      publishedSemesters(GN_2026B),
      semesterSchedule(recentSpan('GN'), {
        instrumentAvailability: [
          instrumentAvailabilityBlock({ instrument: 'GNIRS', location: { port: 3 }, interval: GN_WHOLE }),
          instrumentAvailabilityBlock({ instrument: 'ALOPEKE', location: { place: 'UNKNOWN' }, interval: GN_WHOLE }),
          instrumentAvailabilityBlock({
            instrument: 'NIRI',
            location: { place: 'BASE' },
            usage: 'UNAVAILABLE',
            interval: GN_WHOLE,
          }),
        ],
      }),
    ],
  });

describe('the filter and page controls a reader can grow past their own box', () => {
  it.each(ROOTS)(
    'keeps the Components Search field showing its own placeholder-length value at a %s root',
    async (root) => {
      document.documentElement.style.fontSize = root;
      const screen = await openComponents(<ComponentsPage />);
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
      const screen = await openInstruments();
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
      const screen = await openComponents(<ComponentsPage />);
      await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

      await selectLongestOption(screen, 'Instrument');
      expectFits(dropdownLabelBox(screen, 'Instrument'));
    },
  );

  it.each(ROOTS)(
    'keeps the Components Type filter showing its own longest selected option at a %s root',
    async (root) => {
      document.documentElement.style.fontSize = root;
      const screen = await openComponents(<ComponentsPage />);
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
      const screen = await openInstruments();
      await expect.element(screen.getByText('GNIRS')).toBeVisible();

      await selectLongestOption(screen, 'Location');
      expectFits(dropdownLabelBox(screen, 'Location'));
    },
  );

  it.each(ROOTS)('keeps the Semester picker showing its own longest selected option at a %s root', async (root) => {
    document.documentElement.style.fontSize = root;
    const screen = await renderWithContext(<SemesterPage />, {
      route: '/semester?site=GS&semester=2025B',
      mocks: [publishedSemesters(GS_2025B, GS_2026B_DEMO), semesterSchedule(GS_2025B), semesterSchedule(GS_2026B_DEMO)],
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
      const instrumentAvailability: readonly InstrumentAvailabilityBlock[] = [
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
        instrumentAvailability,
        telescopeAvailability: [],
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
        <SemesterCalendar
          timeline={timeline}
          semester={semester}
          site="GS"
          instrumentAvailability={instrumentAvailability}
          telescopeAvailability={[]}
        />,
      );
      await expect.element(screen.getByLabelText('Month', { exact: true })).toBeVisible();

      await selectLongestOption(screen, 'Month');
      expectFits(dropdownLabelBox(screen, 'Month'));
    },
  );

  it("lets FilterField's own column shrink so a clamped control's max-w-full is not inert", async () => {
    // Narrower than any one control's own rem width, so the row can only avoid overflowing this
    // 220px `overflow-hidden` stand-in for `.xp-shell` by letting `max-w-full` actually shrink one.
    const screen = await openComponents(
      <div style={{ width: '220px', overflow: 'hidden' }} data-testid="squeeze">
        <ComponentsPage />
      </div>,
    );
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

    await selectLongestOption(screen, 'Type');

    const squeeze = screen.getByTestId('squeeze').element() as HTMLElement;
    expect(squeeze.scrollWidth).toBeLessThanOrEqual(squeeze.clientWidth);
  });
});
