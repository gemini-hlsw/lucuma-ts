import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { describe, expect, it, vi } from 'vitest';

import { renderWithContext } from '@/test/render';

import { FilterField } from './FilterField';

describe(FilterField, () => {
  it('should name the control by the caption alone when it is an input or a dropdown', async () => {
    const screen = await renderWithContext(
      <>
        <FilterField label="Search">{(id) => <InputText id={id} value="" onChange={vi.fn()} />}</FilterField>
        <FilterField label="Instrument">
          {(id) => <Dropdown inputId={id} options={[{ label: 'All', value: 'all' }]} placeholder="All" showClear />}
        </FilterField>
      </>,
    );

    await expect.element(screen.getByLabelText('Search', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Instrument', { exact: true })).toBeInTheDocument();
  });
});
