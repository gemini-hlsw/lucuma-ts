/**
 * The live-failure banner: the way back when the live server fails.
 *
 * `switchDataSource` and `readDataSource` are mocked - the real switch reloads
 * the page, which a test must never do; the failure store itself stays real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type * as dataSourceModule from '@/gql/dataSource';
import { readDataSource, reportLiveFailure, switchDataSource } from '@/gql/dataSource';

import { DataSourceBanner } from './DataSourceBanner';

vi.mock('@/gql/dataSource', async (importOriginal) => {
  const actual = await importOriginal<typeof dataSourceModule>();
  return { ...actual, readDataSource: vi.fn(() => 'LIVE'), switchDataSource: vi.fn() };
});

describe(DataSourceBanner.name, () => {
  beforeEach(() => {
    vi.mocked(readDataSource).mockReturnValue('LIVE');
  });

  it('says what went wrong and offers the way back to demo data', async () => {
    // The failure lands before the banner mounts - the page-load case; the
    // store's reactivity is pinned in dataSource.test.ts.
    reportLiveFailure('The live server could not be reached (Failed to fetch).');
    const screen = await render(<DataSourceBanner />);

    await expect.element(screen.getByTestId('data-source-banner')).toBeVisible();
    await expect.element(screen.getByText('could not be reached', { exact: false })).toBeVisible();

    await screen.getByRole('button', { name: 'Use demo data' }).click();
    expect(switchDataSource).toHaveBeenCalledWith('DEMO');
  });

  it('never shows on the demo source - the demo cannot fail this way', async () => {
    vi.mocked(readDataSource).mockReturnValue('DEMO');
    reportLiveFailure('anything');
    const screen = await render(<DataSourceBanner />);

    await expect.element(screen.getByTestId('data-source-banner')).not.toBeInTheDocument();
  });
});
