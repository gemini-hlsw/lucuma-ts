import { toastAtom } from '@gemini-hlsw/lucuma-common-ui';
import type { Store } from 'jotai';
import type { ToastMessage } from 'primereact/toast';
import { expect, vi } from 'vitest';
import { type Locator, type LocatorSelectors, page, userEvent } from 'vitest/browser';

import { type Site, SITE_NAMES } from '@/domain/types';

export const UNDECODABLE_TOKEN = 'header.payload.signature';

/** `Date` moves with the timeouts, since a delay set from a real `Date.now()` drifts off the fake timeline. */
export const fakeTimeouts = (): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
};

/**
 * The clock alone: `expect.poll`, the router, Apollo and Highcharts keep the real `setTimeout`.
 * `shouldAdvanceTime` keeps the wall clock running underneath, for a subject that waits on real time too.
 */
export const fakeClock = (at: number, { shouldAdvanceTime = false }: { shouldAdvanceTime?: boolean } = {}): void => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], shouldAdvanceTime });
  vi.setSystemTime(at);
};

export async function chooseSite(sut: LocatorSelectors, site: Site): Promise<void> {
  await sut.getByRole('button', { name: SITE_NAMES[site] }).click();
}

export async function openAppMenu(sut: LocatorSelectors): Promise<void> {
  await sut.getByRole('button', { name: 'Menu' }).click();
  await expect.element(page.getByRole('menuitem', { name: 'About Resource' })).toBeVisible();
}

/**
 * The clock is a menu choice now, so every test that moves it opens the menu the reader opens.
 * Choosing closes the menu, so a test asserting the new state must open it again.
 */
export async function chooseClock(sut: LocatorSelectors, label: 'Site time' | 'UTC'): Promise<void> {
  await openAppMenu(sut);
  const choice = clockChoice(label);
  await expect.element(choice).toBeVisible();
  await userEvent.click(choice);
}

export const clockChoice = (label: 'Site time' | 'UTC'): Locator =>
  page.getByRole('menuitemradio', { name: `Clock: ${label}`, exact: true });

/** The toasts whose text includes `summary`; PrimeReact renders them into `document.body`. */
export const toastNamed = (summary: string): Locator => page.getByRole('alert').filter({ hasText: summary });

const FLUSH = { severity: 'info', summary: 'Flushed' } satisfies ToastMessage;

/** Toasts still on screen, leaving out those closing and the one `afterPendingWork` flushes with. */
export const toastsShowing = (): string[] =>
  page
    .getByRole('alert')
    .elements()
    .filter((toast) => !toast.classList.contains('p-toast-message-exit'))
    .map((toast) => toast.textContent)
    .filter((text) => text !== FLUSH.summary);

/** Once this toast renders, so has every update queued before it, including a show from a promise already settled, whose callbacks run before React renders. */
export async function afterPendingWork(store: Store): Promise<void> {
  const toast = store.get(toastAtom)!;
  toast.show(FLUSH);
  await expect.element(toastNamed(FLUSH.summary)).toBeInTheDocument();
  toast.remove(FLUSH);
}

/** The text of every element `selector` matches, in document order. */
export const textsOf = (selector: string): readonly string[] =>
  [...document.querySelectorAll(selector)].map((node) => node.textContent ?? '');

/** The open dropdown's options, in order; PrimeReact renders the panel into `document.body`. */
export const dropdownOptionTexts = (): readonly string[] => textsOf('[role="option"]');
