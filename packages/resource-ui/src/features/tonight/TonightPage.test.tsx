import { renderWithContext } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it, vi } from 'vitest';

import { createTelescopeNightTimeline } from '../../test/factories';

vi.mock('./Timeline', () => ({
  Timeline: () => <div data-testid="timeline" />,
}));

const useTelescopeNightTimeline = vi.fn();

vi.mock('../../gql/telescope', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  useTelescopeNightTimeline: () => useTelescopeNightTimeline(),
}));

describe('TonightPage', () => {
  it('renders the loading state', async () => {
    useTelescopeNightTimeline.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    });

    const { default: TonightPage } = await import('./TonightPage');

    const { getByText } = await renderWithContext(<TonightPage />);

    await expect.element(getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the error state', async () => {
    useTelescopeNightTimeline.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('Request failed'),
    });

    const { default: TonightPage } = await import('./TonightPage');

    const { getByText } = await renderWithContext(<TonightPage />);

    await expect.element(getByText('Error: Request failed')).toBeInTheDocument();
  });

  it('renders the empty state', async () => {
    useTelescopeNightTimeline.mockReturnValue({
      data: { telescopeNightTimeline: null },
      loading: false,
      error: undefined,
    });

    const { default: TonightPage } = await import('./TonightPage');

    const { getByText } = await renderWithContext(<TonightPage />);

    await expect.element(getByText('No data found.')).toBeInTheDocument();
  });

  it('renders the timeline page when data exists', async () => {
    const timeline = createTelescopeNightTimeline();

    useTelescopeNightTimeline.mockReturnValue({
      data: { telescopeNightTimeline: timeline },
      loading: false,
      error: undefined,
    });

    const { default: TonightPage } = await import('./TonightPage');

    const { getByRole, getByTestId } = await renderWithContext(<TonightPage />);

    await expect.element(getByRole('heading', { name: timeline.observingNight })).toBeInTheDocument();
    await expect.element(getByTestId('timeline')).toBeInTheDocument();
  });
});
