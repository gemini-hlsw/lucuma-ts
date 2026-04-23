import { renderWithContext } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it } from 'vitest';

import Sidebar from './Sidebar';
import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

describe(Sidebar.name, () => {
  it('renders all sidebar section titles', async () => {
    const { getByText } = await renderWithContext(<Sidebar />);

    await expect.element(getByText('Overview')).toBeInTheDocument();
    await expect.element(getByText('Telescope')).toBeInTheDocument();
    await expect.element(getByText('Instruments')).toBeInTheDocument();
    await expect.element(getByText('Staff & Roles')).toBeInTheDocument();
  });

  it('renders configured navigation item labels', async () => {
    const { getByText } = await renderWithContext(<Sidebar />);

    await expect.element(getByText('Tonight')).toBeInTheDocument();
    await expect.element(getByText('Schedule')).toBeInTheDocument();
  });

  it('renders the primary navigation landmark', async () => {
    const { getByRole } = await renderWithContext(<Sidebar />);

    await expect.element(getByRole('navigation', { name: /primary navigation/i })).toBeInTheDocument();
  });

  it('renders enabled navigation items as links', async () => {
    const { getByRole } = await renderWithContext(<Sidebar />);

    const scheduleLink = getByRole('link', { name: /schedule/i });

    await expect.element(scheduleLink).toBeInTheDocument();
    await expect.element(scheduleLink).toHaveAttribute('href', '/telescope-schedule');
  });

  it('marks disabled navigation items as aria-disabled', async () => {
    const { getByText } = await renderWithContext(<Sidebar />);

    const tonightLabel = getByText('Tonight').element();
    const disabledContainer = tonightLabel.closest('[aria-disabled="true"]');

    expect(disabledContainer).not.toBeNull();
    expect(disabledContainer?.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders only enabled items as interactive links', async () => {
    const { getByRole } = await renderWithContext(<Sidebar />);
    const nav = getByRole('navigation', { name: /primary navigation/i }).element();
    const enabledLinks = Array.from(nav.querySelectorAll('a')).filter(
      (link) => link.getAttribute('aria-disabled') !== 'true',
    );
    const expectedEnabledCount = SIDEBAR_MENU_SECTIONS.flatMap((section) => section.items).filter(
      (item) => item.disabled !== true,
    ).length;
    expect(enabledLinks).toHaveLength(expectedEnabledCount);
  });
});
