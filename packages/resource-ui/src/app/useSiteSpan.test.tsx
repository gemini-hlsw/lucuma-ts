import { beforeEach, describe, expect, it } from 'vitest';

import { Probe } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useSiteSpan } from './useSiteSpan';

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

    // Observing-night edges, not calendar days: 18:00Z at both ends, Chile being on UTC-4 in August.
    await expect
      .element(screen.getByTestId('probe-span'))
      .toHaveTextContent('2024-08-01T18:00:00.000Z/2026-08-01T18:00:00.000Z');
  });

  it('follows the site, since a site s record is not the other s', async () => {
    const screen = await openSpan('/components?site=GN&semester=2026B');

    // The site is read off the semesters, so both ends move to the site's own 14:00 boundary.
    await expect
      .element(screen.getByTestId('probe-span'))
      .toHaveTextContent('2024-08-02T00:00:00.000Z/2027-02-02T00:00:00.000Z');
  });

  it('answers null before the semester list arrives, rather than an empty window', async () => {
    const screen = await openSpan('/components?site=GS');
    await expect.element(screen.getByTestId('probe-span')).not.toHaveTextContent('loading');

    // A caller must tell "not known yet" from "the site has nothing".
    expect(printed[0]).toBe('loading');
  });
});
