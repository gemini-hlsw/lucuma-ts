import { expect } from 'vitest';
import { type Locator, type LocatorSelectors, page, userEvent } from 'vitest/browser';

/**
 * A dropdown: a `Locator`, the accessible name of its button (its placeholder
 * while empty), or `{ label }` for the label of its input.
 */
export type DropdownTarget = Locator | string | { readonly label: string };

/**
 * Opens a PrimeReact dropdown once it is enabled and has loaded.
 * Clicking an open dropdown closes it.
 */
export async function openDropdown(sut: LocatorSelectors, dropdown: DropdownTarget): Promise<void> {
  const byLabel = typeof dropdown === 'object' && 'label' in dropdown;
  const locator =
    typeof dropdown === 'string'
      ? sut.getByRole('button', { name: dropdown, exact: true })
      : byLabel
        ? sut.getByLabelText(dropdown.label, { exact: true })
        : dropdown;
  await expect.element(locator).toBeEnabled();

  // A label names the input, so use its `.p-dropdown` wrapper instead.
  const root = (): Element | null => (byLabel ? locator.element().closest('.p-dropdown') : locator.element());
  // The trigger icon replaces the loading spinner once options load.
  await expect.poll(() => root()?.querySelector<HTMLElement>('.p-dropdown-trigger-icon')).toBeVisible();

  await userEvent.click(byLabel ? root()! : locator);
}

/** Opens `dropdown`, then clicks the option named exactly `optionLabel`. */
export async function selectDropdownOption(
  sut: LocatorSelectors,
  dropdown: DropdownTarget,
  optionLabel: string,
): Promise<void> {
  await openDropdown(sut, dropdown);

  const option = page.getByRole('listbox').getByRole('option', { name: optionLabel, exact: true });
  await expect.element(option).toBeVisible();
  await userEvent.click(option);
}
