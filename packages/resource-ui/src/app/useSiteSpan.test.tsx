/**
 * `useSiteSpan` - the interval the two inventory browsers query over.
 *
 * The point of it is that the finders are **site**-scoped, not semester-scoped:
 * "where is Zorro" is not a semester question, and a piece's history does not
 * restart in February. So this must cover the site's whole record, and it must
 * answer null - not an empty interval - while the semester list is still on its
 * way, or a browser would query 1970 and report an empty catalog.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { Probe } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useSiteSpan } from './useSiteSpan';

/** Every value the hook has printed this test, oldest first. */
let printed: string[] = [];

beforeEach(() => {
  printed = [];
});

const openSpan = async (route: string) =>
  renderApp({
    route,
    element: (
      <Probe
        use={useSiteSpan}
        readout={(span) => {
          const value = span === null ? 'loading' : `${span.start}/${span.end}`;
          printed.push(value);
          return { span: value };
        }}
      />
    ),
  });

describe(useSiteSpan, () => {
  it('covers the site s whole record, from its first semester to its last', async () => {
    const screen = await openSpan('/components?site=GS&semester=2025B');

    // GS runs 2024B through 2026A in the workbook. A semester-scoped window
    // would answer with silence for a piece that sits out the chosen one.
    await expect
      .element(screen.getByTestId('probe-span'))
      .toHaveTextContent('2024-08-02T00:00:00.000Z/2026-08-01T23:59:59.999Z');
  });

  it('follows the site, since a site s record is not the other s', async () => {
    const screen = await openSpan('/components?site=GN&semester=2026B');

    // GN carries a further semester than GS: 2026B, ending 2027-02-01.
    await expect
      .element(screen.getByTestId('probe-span'))
      .toHaveTextContent('2024-08-02T00:00:00.000Z/2027-02-01T23:59:59.999Z');
  });

  it('answers null before the semester list arrives, rather than an empty window', async () => {
    const screen = await openSpan('/components?site=GS');
    await expect.element(screen.getByTestId('probe-span')).not.toHaveTextContent('loading');

    // The first paint, before the query resolved. A caller must be able to
    // tell "not known yet" from "the site has nothing" - a zero-length window
    // here would have the browsers report an empty catalog for a moment.
    expect(printed[0]).toBe('loading');
  });
});
