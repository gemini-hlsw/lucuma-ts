import '@/styles/global.css';
import '@/styles/main.css';

import { toastAtom } from '@gemini-hlsw/lucuma-common-ui';
import type { ToastMessage } from 'primereact/toast';
import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { renderWithContext } from '@/test/render';
import { contrastOn, pixelOver } from '@/test/styleProbe';

import { ToastOutlet } from './ToastOutlet';

const EXPIRED = {
  severity: 'warn',
  summary: 'Session ended',
  detail: 'Sign in again.',
  sticky: true,
} satisfies ToastMessage;

const showSticky = async (message: ToastMessage & { severity: string; summary: string }) => {
  const screen = await renderWithContext(<ToastOutlet />);
  await expect.poll(() => screen.store.get(toastAtom)).not.toBeNull();
  screen.store.get(toastAtom)!.show(message);
  await expect.element(screen.getByText(message.summary)).toBeVisible();
  return document.querySelector<HTMLElement>(`.p-toast-message-${message.severity}`)!;
};

const fillOf = (message: HTMLElement) =>
  pixelOver(getComputedStyle(message).backgroundColor, getComputedStyle(document.body).backgroundColor);

describe(ToastOutlet, () => {
  beforeAll(() => {
    document.documentElement.classList.add('dark');
  });

  it('paints a warn toast opaque, its words at 4.5:1 or better on its fill', async () => {
    const message = await showSticky(EXPIRED);

    expect(getComputedStyle(document.querySelector('.p-toast')!).opacity).toBe('1');
    const fill = fillOf(message);
    for (const words of [message.querySelector('.p-toast-summary')!, message.querySelector('.p-toast-detail')!]) {
      expect(contrastOn(getComputedStyle(words).color, fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['success', 'info', 'warn', 'error'] as const)(
    'rings the keyboard-focused close button at 3:1 or better on a %s fill',
    async (severity) => {
      const message = await showSticky({ severity, summary: `Something ${severity}`, sticky: true });
      const close = message.querySelector<HTMLElement>('.p-toast-icon-close')!;

      await userEvent.tab();

      expect(document.activeElement).toBe(close);
      const style = getComputedStyle(close);
      expect(style.outlineStyle).toBe('solid');
      expect(style.outlineWidth).toBe('2px');
      const fill = fillOf(message);
      expect(contrastOn(style.outlineColor, fill)).toBeGreaterThanOrEqual(3);
    },
  );

  it('spans a 320px viewport inside 20px gutters', async () => {
    await page.viewport(320, 640);
    const message = await showSticky(EXPIRED);

    const { left, right } = message.getBoundingClientRect();
    expect(left).toBe(20);
    expect(right).toBe(300);
  });
});
