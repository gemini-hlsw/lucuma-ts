import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { AboutResource } from '@/components/layout/AboutResource';

import { contentBoxHeight, lastTextLineRect } from './styleProbe';

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

export function expectVersionOnOneLine(row: HTMLElement): void {
  const button = row.querySelector('button')!.getBoundingClientRect();
  expect(contentBoxHeight(row)).toBeCloseTo(button.height, 0);
}

export function expectCopyButtonBesideLastToken(row: HTMLElement): void {
  const tail = lastTextLineRect(row);
  const button = row.querySelector<HTMLElement>('button[aria-label="Copy version"]')!.getBoundingClientRect();
  expect(button.top).toBeLessThan(tail.bottom);
  expect(button.bottom).toBeGreaterThan(tail.top);
  expect(button.left).toBeGreaterThanOrEqual(tail.right);
  expect(button.height).toBe(28);
}
