import { Dropdown } from 'primereact/dropdown';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { openDropdown, selectDropdownOption } from './primereact.ts';

/** A dropdown that shows PrimeReact's loading spinner until its options arrive. */
function LoadingDropdown() {
  const [options, setOptions] = useState<string[] | undefined>();
  const [value, setValue] = useState<string | undefined>();
  useEffect(() => {
    const timer = setTimeout(() => setOptions(['Red', 'Blue']), 600);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Dropdown
      placeholder="Select filter"
      loading={options === undefined}
      options={options ?? []}
      value={value}
      onChange={(e) => setValue(e.value as string)}
    />
  );
}

describe(openDropdown, () => {
  it('waits for the loading spinner to give way to the trigger icon', async () => {
    const sut = await render(<LoadingDropdown />);

    await openDropdown(sut, 'Select filter');

    expect(sut.container.querySelector('.p-icon-spin')).toBeNull();
    await expect.element(page.getByRole('option', { name: 'Red', exact: true })).toBeVisible();
  });
});

describe(selectDropdownOption, () => {
  it('picks the option once the dropdown has loaded', async () => {
    const sut = await render(<LoadingDropdown />);

    await selectDropdownOption(sut, 'Select filter', 'Blue');

    await expect.poll(() => sut.container.querySelector('.p-dropdown-label')?.textContent).toBe('Blue');
  });
});
