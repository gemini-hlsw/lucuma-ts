import { describe, expect, it } from 'vitest';

import { renderWithContext } from '@/test/render';

import { DataSourceBadge } from './DataSourceBadge';

describe(DataSourceBadge, () => {
  it('shows the error only when the query left the view empty', async () => {
    // The sc-10153 case: with Apollo's errorPolicy 'all', a benign
    // per-observation warning arrives alongside a full result. Data loaded, so
    // the badge must read as live rather than surfacing the warning as a failure.
    const withData = await renderWithContext(
      <DataSourceBadge loading={false} error="Could not compute GHOST IFU mapping" empty={false} />,
    );
    await expect.element(withData.getByText('Live data')).toBeInTheDocument();
    expect(withData.container.textContent).not.toContain('GHOST');
  });

  it('surfaces the error when it left the view with no rows', async () => {
    const noData = await renderWithContext(
      <DataSourceBadge loading={false} error="Token expired or invalid — sign in again." empty={true} />,
    );
    await expect.element(noData.getByText('Token expired or invalid — sign in again.')).toBeInTheDocument();
  });

  it('reads as loading, empty, or live for the non-error states', async () => {
    const loading = await renderWithContext(<DataSourceBadge loading={true} />);
    await expect.element(loading.getByText('Loading…')).toBeInTheDocument();

    const empty = await renderWithContext(<DataSourceBadge loading={false} empty={true} />);
    await expect.element(empty.getByText('No records for your role')).toBeInTheDocument();

    const live = await renderWithContext(<DataSourceBadge loading={false} empty={false} />);
    await expect.element(live.getByText('Live data')).toBeInTheDocument();
  });
});
