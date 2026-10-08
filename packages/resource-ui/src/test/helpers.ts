import { act as reactAct } from 'react';
import { expect } from 'vitest';
import { type LocatorSelectors, page, userEvent } from 'vitest/browser';

/** Commits every React update `callback` caused, then turns the act environment off again as vitest-browser-react does, so updates outside act raise no warnings. */
export async function act(callback: () => unknown): Promise<void> {
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await reactAct(async () => {
      await callback();
    });
  } finally {
    environment.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

export async function openDropdown(sut: LocatorSelectors, label: string): Promise<void> {
  const wrapper = sut.getByLabelText(label, { exact: true }).element().closest('.p-dropdown');
  expect(wrapper).not.toBeNull();
  await userEvent.click(wrapper!);
}

/** The option name matches exactly, so pass the full label, count included: "GMOS (36)". */
export async function selectDropdownOption(sut: LocatorSelectors, label: string, optionLabel: string): Promise<void> {
  await openDropdown(sut, label);
  const option = page.getByRole('listbox').getByRole('option', { name: optionLabel });
  await expect.element(option).toBeVisible();
  await userEvent.click(option);
}

export async function chooseSite(sut: LocatorSelectors, site: 'GN' | 'GS'): Promise<void> {
  await sut.getByRole('button', { name: site === 'GN' ? 'Gemini North' : 'Gemini South' }).click();
}

export async function openAppMenu(sut: LocatorSelectors): Promise<void> {
  await sut.getByRole('button', { name: 'Menu' }).click();
  await expect.element(page.getByRole('menuitem', { name: 'About Resource' })).toBeVisible();
}

/** Through the menu, as the reader does; choosing closes it, so a test asserting the new state reopens it. */
export async function chooseClock(sut: LocatorSelectors, label: 'Site time' | 'UTC'): Promise<void> {
  await openAppMenu(sut);
  const choice = page.getByRole('menuitemradio', { name: `Clock: ${label}`, exact: true });
  await expect.element(choice).toBeVisible();
  await userEvent.click(choice);
}
