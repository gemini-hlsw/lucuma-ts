import { renderWithContext } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createTelescopeNightTimeline } from '../../test/factories';
import { Header } from './Header';
import type { TimelineTimeDisplay } from './time';

const renderHeader = async (timeDisplay: TimelineTimeDisplay = 'site', onTimeDisplayChange = vi.fn()) => {
  const timeline = createTelescopeNightTimeline();

  return {
    timeline,
    ...(await renderWithContext(
      <Header timeline={timeline} timeDisplay={timeDisplay} onTimeDisplayChange={onTimeDisplayChange} />,
    )),
  };
};

describe(Header.name, () => {
  it('renders the observing night', async () => {
    const { getByRole, timeline } = await renderHeader();

    await expect.element(getByRole('heading', { name: timeline.observingNight })).toBeInTheDocument();
  });

  it('renders the site selector as disabled', async () => {
    const { getByRole, timeline } = await renderHeader();

    await expect.element(getByRole('button', { name: timeline.site })).toBeDisabled();
  });

  it('shows the selected time display', async () => {
    const { getByRole } = await renderHeader('utc');

    await expect.element(getByRole('button', { name: 'UTC' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onTimeDisplayChange when the time display changes', async () => {
    const onTimeDisplayChange = vi.fn();
    const { getByRole } = await renderHeader('site', onTimeDisplayChange);

    await userEvent.click(getByRole('button', { name: 'UTC' }));

    expect(onTimeDisplayChange).toHaveBeenCalledExactlyOnceWith('utc');
  });
});
