/**
 * Shared browser-test helpers - navigate-ui's dropdown driver, adapted to
 * dropdowns named by their `<label>`.
 *
 * The name lands on a hidden input (`LabelledControl` points `htmlFor` at the
 * Dropdown's `inputId`, which PrimeReact puts on its keyboard helper); the
 * clickable surface is the .p-dropdown wrapper around it, and the options panel
 * renders into document.body - outside any render container - so options are
 * reached through `page`, scoped through the listbox so the hidden native
 * <select> mirror never matches.
 */
import { expect } from 'vitest';
import { type LocatorSelectors, page, userEvent } from 'vitest/browser';

/** Opens the PrimeReact Dropdown accessibly named `label`. */
export async function openDropdown(sut: LocatorSelectors, label: string): Promise<void> {
  const wrapper = sut.getByLabelText(label, { exact: true }).element().closest('.p-dropdown');
  expect(wrapper).not.toBeNull();
  await userEvent.click(wrapper!);
}

/**
 * Selects the option named `optionLabel` from the dropdown named `label`.
 * The option name matches by substring, so "GMOS" finds "GMOS (12)".
 */
export async function selectDropdownOption(sut: LocatorSelectors, label: string, optionLabel: string): Promise<void> {
  await openDropdown(sut, label);
  const option = page.getByRole('listbox').getByRole('option', { name: optionLabel });
  await expect.element(option).toBeVisible();
  await userEvent.click(option);
}
