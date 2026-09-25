import '@/styles/global.css';
import '@/styles/main.css';

import { Provider as JotaiProvider } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import type { ToastMessage } from 'primereact/toast';
import { type ReactNode, useEffect } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { store } from '@/components/atoms/store';
import { toastAtom, useToast } from '@/components/atoms/toast';
import { contrastRatio, pixelOver } from '@/test/styleProbe';

import { ToastOutlet } from './ToastOutlet';

const SAVED = { severity: 'success', summary: 'Run saved', detail: 'The night is up to date.' } satisfies ToastMessage;
const EXPIRED = {
  severity: 'warn',
  summary: 'Session ended',
  detail: 'Sign in again.',
  sticky: true,
} satisfies ToastMessage;

function ShowButton({ message }: { message: ToastMessage }) {
  const toast = useToast();
  return <button onClick={() => toast?.show(message)}>Show</button>;
}

function ShowOnHandle({ message }: { message: ToastMessage }) {
  const toast = useToast();
  useEffect(() => {
    toast?.show(message);
  }, [toast, message]);
  return null;
}

const renderOutlet = (children?: ReactNode) =>
  render(
    <PrimeReactProvider>
      <JotaiProvider store={store}>
        {children}
        <ToastOutlet />
      </JotaiProvider>
    </PrimeReactProvider>,
  );

const showSticky = async (message: ToastMessage & { severity: string; summary: string }) => {
  const screen = await renderOutlet();
  await expect.poll(() => store.get(toastAtom)).not.toBeNull();
  store.get(toastAtom)!.show(message);
  await expect.element(screen.getByText(message.summary)).toBeVisible();
  return document.querySelector<HTMLElement>(`.p-toast-message-${message.severity}`)!;
};

const fillOf = (message: HTMLElement) =>
  pixelOver(getComputedStyle(message).backgroundColor, getComputedStyle(document.body).backgroundColor);

const asCss = ([r, g, b]: readonly number[]) => `rgb(${r} ${g} ${b})`;

describe(ToastOutlet, () => {
  beforeAll(() => {
    document.documentElement.classList.add('dark');
  });

  it('shows a toast from a component that asks for the handle', async () => {
    const screen = await renderOutlet(<ShowButton message={SAVED} />);

    await screen.getByRole('button', { name: 'Show' }).click();

    const alert = screen.getByRole('alert');
    await expect.element(alert.getByText(SAVED.summary)).toBeVisible();
    await expect.element(alert.getByText(SAVED.detail)).toBeVisible();
  });

  it('clears the handle when the outlet unmounts', async () => {
    const screen = await renderOutlet();
    await expect.poll(() => store.get(toastAtom)).not.toBeNull();

    await screen.unmount();

    expect(store.get(toastAtom)).toBeNull();
  });

  it('keeps one handle across a show and a remove, so an effect on it shows once', async () => {
    const screen = await renderOutlet(<ShowOnHandle message={SAVED} />);

    await expect.element(screen.getByText(SAVED.summary)).toBeVisible();
    expect(document.querySelectorAll('.p-toast-message')).toHaveLength(1);
    const handle = store.get(toastAtom);
    handle!.remove(SAVED);

    await expect.element(screen.getByText(SAVED.summary)).not.toBeInTheDocument();
    expect(store.get(toastAtom)).toBe(handle);
  });

  it('removes only the message it is handed back', async () => {
    const screen = await renderOutlet();
    await expect.poll(() => store.get(toastAtom)).not.toBeNull();
    const toast = store.get(toastAtom)!;

    toast.show(SAVED);
    toast.show(EXPIRED);
    await expect.element(screen.getByText(EXPIRED.summary)).toBeVisible();
    toast.remove(SAVED);

    await expect.element(screen.getByText(SAVED.summary)).not.toBeInTheDocument();
    await expect.element(screen.getByText(EXPIRED.summary)).toBeVisible();
  });

  it('paints a warn toast opaque, its words at 4.5:1 or better on its fill', async () => {
    const message = await showSticky(EXPIRED);

    expect(getComputedStyle(document.querySelector('.p-toast')!).opacity).toBe('1');
    const fill = fillOf(message);
    for (const words of [message.querySelector('.p-toast-summary')!, message.querySelector('.p-toast-detail')!]) {
      const ink = pixelOver(getComputedStyle(words).color, asCss(fill));
      expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
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
      const ring = pixelOver(style.outlineColor, asCss(fill));
      expect(contrastRatio(ring, fill)).toBeGreaterThanOrEqual(3);
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
