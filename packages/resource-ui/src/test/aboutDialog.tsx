import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { AboutResource } from '@/components/layout/AboutResource';

export async function openDialog(width = 1024, height = 768): Promise<HTMLElement> {
  await page.viewport(width, height);
  await render(<AboutResource visible onHide={() => undefined} />);
  const dialog = page.getByTestId('about-resource');
  await expect.element(dialog).toBeVisible();
  return dialog.element() as HTMLElement;
}

export function value(dialog: HTMLElement, caption: string): HTMLElement {
  const header = [...dialog.querySelectorAll('td[role="rowheader"]')].find((node) => node.textContent === caption);
  expect(header, `no ${caption} caption`).toBeDefined();
  return header!.nextElementSibling as HTMLElement;
}
