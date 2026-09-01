import { expect } from 'vitest';
import { type LocatorSelectors, page, userEvent } from 'vitest/browser';

/** Opens the PrimeReact Dropdown accessibly named `label`. */
export async function openDropdown(sut: LocatorSelectors, label: string): Promise<void> {
  const wrapper = sut.getByLabelText(label, { exact: true }).element().closest('.p-dropdown');
  expect(wrapper).not.toBeNull();
  await userEvent.click(wrapper!);
}

/** The option name matches by substring, so "GMOS" finds "GMOS (12)". */
export async function selectDropdownOption(sut: LocatorSelectors, label: string, optionLabel: string): Promise<void> {
  await openDropdown(sut, label);
  const option = page.getByRole('listbox').getByRole('option', { name: optionLabel });
  await expect.element(option).toBeVisible();
  await userEvent.click(option);
}
