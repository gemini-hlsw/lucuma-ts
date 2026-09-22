import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { CURRENT_ENV, liveGraphqlEndpoint } from '@/app/environment';

import { AboutResource } from './AboutResource';

const buildVersion = `${import.meta.env.FRONTEND_VERSION}-${CURRENT_ENV.versionSuffix}`;

async function openDialog(): Promise<HTMLElement> {
  await render(<AboutResource visible onHide={() => undefined} />);
  const dialog = page.getByTestId('about-resource');
  await expect.element(dialog).toBeVisible();
  return dialog.element() as HTMLElement;
}

function value(dialog: HTMLElement, caption: string): HTMLElement {
  const header = [...dialog.querySelectorAll('td[role="rowheader"]')].find((node) => node.textContent === caption);
  expect(header, `no ${caption} caption`).toBeDefined();
  return header!.nextElementSibling as HTMLElement;
}

describe(AboutResource, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as { clipboard?: Clipboard }).clipboard;
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

    await expect.poll(() => button.element().querySelector('svg')?.getAttribute('data-icon')).toBe('check');
    expect(written).toHaveLength(1);
    expect(written[0]).toBe(buildVersion);
  });

  it('stays quiet when the browser exposes no clipboard', async () => {
    const rejections: string[] = [];
    const onRejection = (event: PromiseRejectionEvent): void => {
      rejections.push(String(event.reason));
    };
    window.addEventListener('unhandledrejection', onRejection);
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    try {
      const dialog = await openDialog();
      const button = page.getByTestId('about-resource').getByRole('button', { name: 'Copy version' });
      await button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(rejections).toEqual([]);
      expect(button.element().querySelector('svg')?.getAttribute('data-icon')).toBe('copy');
      expect(dialog.querySelector('svg')).not.toBeNull();
    } finally {
      window.removeEventListener('unhandledrejection', onRejection);
    }
  });

  it('says what Resource is before it says which build is running', async () => {
    const dialog = await openDialog();

    await expect.element(page.getByText('Telescope calendar and operational-resource manager.')).toBeVisible();
    const description = dialog.querySelector('p')!;
    expect(description.compareDocumentPosition(dialog.querySelector('table')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('names the endpoint, the version and the environment as an aligned table of facts', async () => {
    const dialog = await openDialog();

    expect(value(dialog, 'Endpoint').textContent).toBe(liveGraphqlEndpoint);
    expect(import.meta.env.FRONTEND_VERSION).not.toBe('');
    expect(value(dialog, 'Version').textContent).toBe(buildVersion);
    expect(value(dialog, 'Environment').textContent).toBe(CURRENT_ENV.name);
  });

  it('keeps the copy button on the version row rather than on a line of its own', async () => {
    const dialog = await openDialog();

    const button = dialog.querySelector('button[aria-label="Copy version"]');
    expect(value(dialog, 'Version').contains(button)).toBe(true);
  });

  it('sets nothing in the dialog in the muted tone reserved for duplication', async () => {
    const dialog = await openDialog();

    const muted = [...dialog.querySelectorAll('*')].filter((node) => node.classList.contains('text-foreground-muted'));
    expect(muted).toHaveLength(0);
  });
});
