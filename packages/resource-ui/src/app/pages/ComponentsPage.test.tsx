import type { ComponentBrowserQuery } from '@gql/gen/graphql';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { instrumentAvailabilityBlock } from '@/test/fixtures/blocks';
import {
  componentBrowser,
  instrumentComponent,
  instrumentComponentAvailabilityBlock,
} from '@/test/fixtures/components';
import { type PublishedSemesterRow, publishedSemesters, recentSpan } from '@/test/fixtures/semester';
import { eveningsFromTonight, nightsFromTonight, semesterFromTonight } from '@/test/fixtures/tonight';
import { openDropdown, selectDropdownOption } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import ComponentsPage from './ComponentsPage';

const GS_CURRENT = semesterFromTonight('GS', -90, 90);

const COMPONENTS = '/components?site=GS';
const GS_WHOLE = nightsFromTonight('GS', -100, 60);

const GMOS_S = instrumentAvailabilityBlock({
  instrument: 'GMOS',
  publishedName: 'GMOS-S',
  location: { port: 3 },
  interval: GS_WHOLE,
});

const MASK_011 = instrumentComponent({
  id: 'k-gs-GS2026B-011',
  componentType: 'FPU',
  code: 'GS2026B-011',
  name: 'Mask GS2026B-011',
  barcode: '11002801',
});
const MASK_012 = instrumentComponent({
  id: 'k-gs-GS2026B-012',
  componentType: 'FPU',
  code: 'GS2026B-012',
  name: 'Mask GS2026B-012',
  aliases: ['the long mask'],
});
const G_FILTER = instrumentComponent();
const B1200 = instrumentComponent({
  id: 'k-gs-B1200_G5321',
  componentType: 'DISPERSER',
  code: 'B1200_G5321',
  name: 'B1200',
});
const R400 = instrumentComponent({
  id: 'k-gs-R400_G5325',
  componentType: 'DISPERSER',
  code: 'R400_G5325',
  name: 'R400',
});
const R831 = instrumentComponent({
  id: 'k-gs-R831_G5322',
  componentType: 'DISPERSER',
  code: 'R831_G5322',
  name: 'R831',
});
const F2_K_SHORT = instrumentComponent({ id: 'k-gs-F2-Ks', instrument: 'F2', code: 'Ks', name: 'K-short' });
const GSAOI_K_SHORT = instrumentComponent({
  id: 'k-gs-GSAOI-Ks',
  instrument: 'GSAOI',
  code: 'Kshort',
  name: 'K-short',
});
const GSAOI_J = instrumentComponent({ id: 'k-gs-GSAOI-J', instrument: 'GSAOI', code: 'J', name: 'J' });
const GHOST_SLIT = instrumentComponent({
  id: 'k-gs-GHOST-slit',
  instrument: 'GHOST',
  componentType: 'OTHER',
  code: 'SR',
  name: 'Standard resolution slit',
});

const installed = (component: ReturnType<typeof instrumentComponent>) =>
  instrumentComponentAvailabilityBlock({ component, interval: GS_WHOLE });

const FAILED = 'Failed; removed for repair';
/** Installed until the night before `failedAt`, then in the lab to the end of the record. */
const r400Record = (failedAt: number) => [
  instrumentComponentAvailabilityBlock({ component: R400, interval: nightsFromTonight('GS', -100, failedAt - 1) }),
  instrumentComponentAvailabilityBlock({
    component: R400,
    usage: 'UNAVAILABLE',
    location: 'LAB',
    note: FAILED,
    interval: nightsFromTonight('GS', failedAt, 60),
  }),
];
const R400_FAILED_AT = -20;
const R400_RECORD = r400Record(R400_FAILED_AT);
const R400_OUT = eveningsFromTonight('GS', R400_FAILED_AT, 60);

const CATALOG = [MASK_011, MASK_012, G_FILTER, B1200, F2_K_SHORT, GSAOI_K_SHORT];

const openComponents = (
  route: string,
  data: Partial<ComponentBrowserQuery>,
  semesters: readonly [PublishedSemesterRow, ...PublishedSemesterRow[]] = [GS_CURRENT],
) =>
  renderWithContext(<ComponentsPage />, {
    route,
    mocks: [publishedSemesters(...semesters), componentBrowser(recentSpan(semesters[0].site), data)],
  });

/** The failing R400 among the instrument blocks its "Installed" resolves against. */
const openR400 = (record = R400_RECORD) =>
  openComponents(COMPONENTS, {
    components: [R400],
    instrumentComponentAvailability: record,
    instrumentAvailability: [GMOS_S],
  });

describe(ComponentsPage, () => {
  it('lists the site catalog with identity, one row per piece', async () => {
    const screen = await openComponents(COMPONENTS, { components: [MASK_011] });

    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText(/barcode 11002801/)).toBeVisible();
  });

  it('says where an installed piece is by joining its instrument - port and name', async () => {
    const screen = await openComponents(COMPONENTS, {
      components: [G_FILTER],
      instrumentComponentAvailability: [installed(G_FILTER)],
      instrumentAvailability: [GMOS_S],
    });

    await expect.element(screen.getByText('Port 3 · GMOS-S').first()).toBeVisible();
  });

  it('names the storage place for a spare', async () => {
    const screen = await openComponents(COMPONENTS, {
      components: [R831, B1200],
      instrumentComponentAvailability: [
        instrumentComponentAvailabilityBlock({
          component: R831,
          usage: 'UNAVAILABLE',
          location: 'LAB',
          interval: GS_WHOLE,
        }),
        instrumentComponentAvailabilityBlock({
          component: B1200,
          usage: 'UNAVAILABLE',
          location: 'BASE',
          interval: GS_WHOLE,
        }),
      ],
    });

    await expect.element(screen.getByText('Summit lab').first()).toBeVisible();
    await expect.element(screen.getByText('Base facility').first()).toBeVisible();
  });

  it('search narrows across name, code, barcode and alias', async () => {
    const screen = await openComponents(COMPONENTS, { components: [MASK_011, MASK_012] });
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

    await screen.getByLabelText('Search').fill('the long mask');

    await expect.element(screen.getByText('Mask GS2026B-012')).toBeVisible();
    await expect.element(screen.getByText('Mask GS2026B-011')).not.toBeInTheDocument();
  });

  it('is a sendable link: the filters come from the URL', async () => {
    const screen = await openComponents(`${COMPONENTS}&q=the+long+mask&instrument=GMOS`, {
      components: [MASK_011, MASK_012],
    });

    await expect.element(screen.getByText('Mask GS2026B-012')).toBeVisible();
    await expect.element(screen.getByText('Mask GS2026B-011')).not.toBeInTheDocument();
    // The controls show the linked state, so refining it starts from there.
    await expect.element(screen.getByLabelText('Search')).toHaveValue('the long mask');
  });

  /* `in` answers true for every `Object.prototype` key, so an unguarded lookup would show All over nothing. */
  it('reads instrument=toString as no filter at all, not as a filter matching nothing', async () => {
    const screen = await openComponents(`${COMPONENTS}&instrument=toString`, { components: [MASK_011, F2_K_SHORT] });

    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText('K-short').first()).toBeVisible();
  });

  it('reads instrument=constructor as no filter at all', async () => {
    const screen = await openComponents(`${COMPONENTS}&instrument=constructor`, { components: [MASK_011, F2_K_SHORT] });

    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText('K-short').first()).toBeVisible();
  });

  it('guards the type filter the same way - both maps are plain objects', async () => {
    const screen = await openComponents(`${COMPONENTS}&type=hasOwnProperty`, { components: [MASK_011, B1200] });

    // An FPU and a disperser: both types survive, so nothing was filtered.
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText('B1200').first()).toBeVisible();
  });

  it('shows the failing piece installed before its failure', async () => {
    const screen = await openR400(r400Record(20));

    await expect.element(screen.getByRole('row', { name: /R400/ }).getByText('Port 3 · GMOS-S')).toBeVisible();
  });

  it('shows the failing piece in the lab after its failure, with the reason on the row', async () => {
    const screen = await openR400();

    const row = screen.getByRole('row', { name: /R400/ });
    await expect.element(row.getByText('Summit lab')).toBeVisible();
    // Red is reserved for a piece actually out of service, and the record's own words say why.
    await expect.element(row.getByText('Unavailable')).toBeVisible();
    await expect.element(row.getByText(FAILED)).toBeVisible();
  });

  it('gives the record its own Note column rather than tucking it under the status', async () => {
    const screen = await openR400();

    const table = screen.getByTestId('component-table');
    await expect.element(table.getByRole('columnheader', { name: 'Note' })).toBeVisible();
    await expect.element(table.getByText(FAILED)).toBeVisible();

    const status = table.getByText('Unavailable').element().closest('td');
    const note = table.getByText(FAILED).element().closest('td');
    expect(note).not.toBe(status);
    expect(status?.textContent).toBe('Unavailable');
  });

  it('says a stored piece with nothing wrong is a spare, not broken', async () => {
    const screen = await openComponents(COMPONENTS, {
      components: [R831],
      instrumentComponentAvailability: [
        instrumentComponentAvailabilityBlock({
          component: R831,
          usage: 'UNAVAILABLE',
          location: 'LAB',
          interval: GS_WHOLE,
        }),
      ],
    });

    const row = screen.getByRole('row', { name: /R831/ });
    await expect.element(row.getByText('Spare')).toBeVisible();
    await expect.element(row.getByText('Unavailable')).not.toBeInTheDocument();
  });

  it('groups the catalog by instrument instead of repeating an Instrument column', async () => {
    const screen = await openComponents(COMPONENTS, {
      components: [G_FILTER, MASK_011],
      instrumentComponentAvailability: [installed(G_FILTER)],
      instrumentAvailability: [GMOS_S],
    });

    await expect.element(screen.getByText('2 pieces · 1 on telescope')).toBeVisible();
    await expect.element(screen.getByRole('columnheader', { name: 'Instrument' })).not.toBeInTheDocument();
  });

  it('opens a row into the piece history, phrased in evening dates', async () => {
    const screen = await openR400();

    // PrimeReact labels the toggler with the row's dataKey.
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    const history = screen.getByTestId('component-history');
    await expect.element(history).toBeVisible();
    await expect.element(history.getByText(R400_OUT)).toBeVisible();
    await expect.element(history.getByText(FAILED).first()).toBeVisible();
  });

  it('carries records beyond the semester the masthead happens to show', async () => {
    const screen = await openComponents(
      COMPONENTS,
      {
        components: [R400],
        instrumentComponentAvailability: [
          instrumentComponentAvailabilityBlock({ component: R400, interval: nightsFromTonight('GS', -390, -21) }),
          ...R400_RECORD.slice(1),
          instrumentComponentAvailabilityBlock({ component: R400, interval: nightsFromTonight('GS', 61, 120) }),
        ],
      },
      [semesterFromTonight('GS', -400, -91), GS_CURRENT, semesterFromTonight('GS', 91, 270)],
    );
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    // Scoped to the current semester the history would say nothing about the cut.
    const history = screen.getByTestId('component-history');
    await expect.element(history.getByText(eveningsFromTonight('GS', -390, -21))).toBeVisible();
    await expect.element(history.getByText(eveningsFromTonight('GS', 61, 120))).toBeVisible();
  });

  it('heads the history with its columns, so a reader need not infer them from position', async () => {
    const screen = await openR400();
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    const history = screen.getByTestId('component-history');
    for (const column of ['Dates', 'Nights', 'Location', 'Status', 'Note']) {
      await expect.element(history.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  it('says where "Installed" was, resolving the span against the same instrument blocks the row uses', async () => {
    const screen = await openR400();
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    // The block only says INSTALLED; the port comes from the instrument blocks already in hand.
    const history = screen.getByTestId('component-history');
    await expect.element(history.getByText('Port 3 · GMOS-S').first()).toBeVisible();
    await expect.element(history.getByText('Installed')).not.toBeInTheDocument();
  });

  it('counts the nights a record covers, which is what "how long was it out" asks', async () => {
    const screen = await openR400();
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    const history = screen.getByTestId('component-history');
    await expect
      .element(history.getByRole('row').filter({ hasText: R400_OUT }))
      .toMatchTextContent(String(60 - R400_FAILED_AT + 1));
  });

  it('speaks the row status vocabulary in the history, never the bare enum', async () => {
    const screen = await openR400();
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    const history = screen.getByTestId('component-history');
    await expect.element(history.getByText('Unavailable').first()).toBeVisible();
    await expect.element(history.getByText('Science').first()).toBeVisible();
    await expect.element(history.getByText(/^(SCIENCE|UNAVAILABLE|ENGINEERING)$/)).not.toBeInTheDocument();
  });

  it('filters by instrument', async () => {
    const screen = await openComponents(COMPONENTS, { components: CATALOG });
    // Both F2 and GSAOI carry a K-short; the instrument filter clears them all.
    await expect.element(screen.getByText('K-short').first()).toBeVisible();

    await selectDropdownOption(screen, 'Instrument', 'GMOS (4)');

    await expect.element(screen.getByText('K-short')).not.toBeInTheDocument();
    await expect.element(screen.getByText('B1200').first()).toBeVisible();
  });

  it('filters by component type', async () => {
    const screen = await openComponents(COMPONENTS, { components: CATALOG });
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

    await selectDropdownOption(screen, 'Type', 'Disperser (1)');

    // Masks are FPUs and clear out; the gratings stay.
    await expect.element(screen.getByText('Mask GS2026B-011')).not.toBeInTheDocument();
    await expect.element(screen.getByText('B1200').first()).toBeVisible();
  });

  it('organizes the instrument filter: sorted options carrying their counts', async () => {
    const screen = await openComponents(COMPONENTS, { components: [GSAOI_J, GHOST_SLIT, ...CATALOG] });
    await expect.element(screen.getByText('B1200').first()).toBeVisible();

    await openDropdown(screen, 'Instrument');

    await expect.element(page.getByRole('option', { name: 'GHOST (1)' })).toBeVisible();
    const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
    expect(options).toEqual(['F2 (1)', 'GHOST (1)', 'GMOS (4)', 'GSAOI (2)']);
  });

  it('does not wear a distant demo semester’s flag for a night the gap between semesters leaves uncovered', async () => {
    // Tonight is nearer the demo semester, so a "nearest semester" fallback would borrow its flag.
    const screen = await openComponents(COMPONENTS, {}, [
      semesterFromTonight('GS', -200, -30),
      semesterFromTonight('GS', 10, 190, { demo: true }),
    ]);

    await expect.element(screen.getByTestId('component-table')).toBeVisible();
    await expect.element(screen.getByTestId('synthetic-data-tag')).not.toBeInTheDocument();
  });

  it('flags a night the demo semester actually holds', async () => {
    const screen = await openComponents(COMPONENTS, {}, [
      semesterFromTonight('GS', -200, -30),
      semesterFromTonight('GS', -10, 170, { demo: true }),
    ]);

    await expect.element(screen.getByTestId('component-table')).toBeVisible();
    await expect.element(screen.getByTestId('synthetic-data-tag')).toBeVisible();
  });
});
