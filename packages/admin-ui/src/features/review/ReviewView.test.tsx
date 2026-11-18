import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PositionedSource } from '@/gql/odb/conflicts';
import type { ObservationRow } from '@/gql/types';
import { baseMock, conflictMocks, requestCandidate } from '@/test/conflicts';
import { renderWithContext } from '@/test/render';

import { ReviewView } from './ReviewView';

const MODE = 'GMOS_SOUTH_LONG_SLIT';

/** An observation whose first target is at (30°, -30°) but whose explicit base is at (40°, 10°). */
const observation: ObservationRow = {
  id: 'o-1',
  target: 'NGC 300',
  ra: '02:00:00.00',
  dec: '-30:00:00.0',
  raDeg: 30,
  decDeg: -30,
  base: { raDeg: 40, decDeg: 10 },
  modeType: MODE,
  instrument: 'GMOS-S',
  config: 'GMOS-S, LongSlit',
  conditions: '',
  hours: 1,
  windows: [],
};

const view = (row: ObservationRow) => (
  <ReviewView
    title="Proposals"
    blurb=""
    badge={null}
    items={[{ id: 'p-1', resolved: false, observations: [row] }]}
    columns={[]}
    renderDetail={() => null}
    boilerplate={() => ''}
    onResolve={() => Promise.resolve(true)}
    detailTitle={(item) => item.id}
    noun="proposal"
    resolveMutation="setProposalStatus"
  />
);

describe(ReviewView, () => {
  beforeEach(() => {
    // The duplicates check asks the Gemini archive; it finds nothing here.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('[]')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks an observation for conflicts at its base position', async () => {
    const base: PositionedSource = { id: 'o-1', programId: 'p-1', raDeg: 40, decDeg: 10, modeType: MODE };
    const screen = await renderWithContext(view(observation), {
      mocks: conflictMocks(base, { requests: { matches: [requestCandidate()] } }),
    });
    await expect.element(screen.getByRole('link', { name: 'G-2027B-0421-P' })).toBeVisible();
  });

  it('checks an asterism at the base position the ODB computes', async () => {
    const base: PositionedSource = { id: 'o-1', programId: 'p-1', raDeg: 50, decDeg: 20, modeType: MODE };
    const screen = await renderWithContext(view({ ...observation, base: 'lookup' }), {
      mocks: [baseMock('o-1', [50, 20]), ...conflictMocks(base, { requests: { matches: [requestCandidate()] } })],
    });
    await expect.element(screen.getByRole('link', { name: 'G-2027B-0421-P' })).toBeVisible();
  });

  it('reports an observation with no base position as not checked', async () => {
    const screen = await renderWithContext(view({ ...observation, base: 'none' }));
    await expect.element(screen.getByText(/Not checked, for lack of a position .*: o-1/)).toBeVisible();
  });
});
