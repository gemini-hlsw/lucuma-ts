import { InputNumber } from 'primereact/inputnumber';
import { useState } from 'react';
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

  it('does not call onValueChange again on blur while the value prop has not caught up', async () => {
    const onValueChange = vi.fn();
    // Like a parent that saves on change: the input is disabled while the save
    // runs, and the value prop only updates when the save returns. Chrome 155+
    // blurs the disabled input after the Enter key, so the blur sees the typed
    // value and the old prop.
    function Saving() {
      const [saving, setSaving] = useState(false);
      return (
        <NumberInput
          inputId="n"
          value={null}
          disabled={saving}
          onValueChange={(e) => {
            onValueChange(e);
            setSaving(true);
          }}
        />
      );
    }
    const sut = await render(<Saving />);
    const input = sut.getByRole('spinbutton');

    await userEvent.type(input, '45{Enter}');

    await expect.element(input).toBeDisabled();
    await expect.element(input).not.toHaveFocus();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ value: 45 }));
  });

  it('calls onValueChange on blur for a value that was not sent yet', async () => {
    const onValueChange = vi.fn();
    const sut = await render(
      <>
        <NumberInput inputId="n" value={null} onValueChange={onValueChange} />
        <button>Other</button>
      </>,
    );

    await userEvent.type(sut.getByRole('spinbutton'), '45');
    await userEvent.click(sut.getByRole('button', { name: 'Other' }));

    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({ value: 45 }));
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
