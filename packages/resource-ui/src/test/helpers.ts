import { expect } from 'vitest';
import { type LocatorSelectors, page, userEvent } from 'vitest/browser';

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

/**
 * The clock is a menu choice now, so every test that moves it opens the menu the reader opens.
 * Choosing closes the menu, so a test asserting the new state must open it again.
 */
export async function chooseClock(sut: LocatorSelectors, label: 'Site time' | 'UTC'): Promise<void> {
  await openAppMenu(sut);
  const choice = page.getByRole('menuitemradio', { name: `Clock: ${label}`, exact: true });
  await expect.element(choice).toBeVisible();
  await userEvent.click(choice);
}
