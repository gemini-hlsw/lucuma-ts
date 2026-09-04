import { InputNumber } from 'primereact/inputnumber';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { NumberInput } from './NumberInput.tsx';

describe(NumberInput, () => {
  it('does not call onValueChange when only the value prop changes', async () => {
    const onValueChange = vi.fn();
    const sut = await render(
      <NumberInput inputId="n" value={0.1} minFractionDigits={2} onValueChange={onValueChange} />,
    );

    await sut.rerender(<NumberInput inputId="n" value={0.2} minFractionDigits={2} onValueChange={onValueChange} />);

    await expect.element(sut.getByRole('spinbutton')).toHaveValue('0.20');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('calls onValueChange when the user types a new value', async () => {
    const onValueChange = vi.fn();
    const sut = await render(
      <NumberInput inputId="n" value={0.1} minFractionDigits={2} onValueChange={onValueChange} />,
    );
    const input = sut.getByRole('spinbutton');

    await userEvent.clear(input);
    await userEvent.type(input, '0.2{Enter}');

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ value: 0.2 }));
  });
});

/**
 * The reason why {@link NumberInput} exists. Since primereact 10.9.8,
 * `InputNumber` calls `onValueChange` for every external `value` prop change.
 *
 * If this test fails, primereact fixed the bug. Delete `NumberInput`, delete
 * this file, and use `InputNumber` again at all call sites.
 */
describe('primereact InputNumber', () => {
  it('still echoes a value prop change back through onValueChange', async () => {
    const onValueChange = vi.fn();
    const sut = await render(
      <InputNumber inputId="n" value={0.1} minFractionDigits={2} onValueChange={onValueChange} />,
    );

    await sut.rerender(<InputNumber inputId="n" value={0.2} minFractionDigits={2} onValueChange={onValueChange} />);

    await expect.element(sut.getByRole('spinbutton')).toHaveValue('0.20');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ value: 0.2 }));
  });
});
