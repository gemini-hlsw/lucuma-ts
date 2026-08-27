/**
 * The About dialog's copy control - the one interaction the dialog owns.
 *
 * The clipboard itself is spied: browser test permissions for the real one are
 * flaky, and what the page owes us is the intent and the on-screen answer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { AboutResource } from './AboutResource';

describe(AboutResource, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('confirms the copy on the button itself, and puts the version on the clipboard', async () => {
    const written: string[] = [];
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation((text) => {
      written.push(text);
      return Promise.resolve();
    });

    await render(<AboutResource visible onHide={() => undefined} />);
    const dialog = page.getByTestId('about-resource');
    await expect.element(dialog).toBeVisible();
    const button = dialog.getByRole('button', { name: 'Copy version' });
    expect(button.element().querySelector('svg')?.getAttribute('data-icon')).toBe('copy');

    await button.click();

    // The press must answer on screen - the icon flips to the check - and the
    // clipboard must hold the version the dialog prints.
    await expect.poll(() => button.element().querySelector('svg')?.getAttribute('data-icon')).toBe('check');
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/-DEV$/);
  });
});
