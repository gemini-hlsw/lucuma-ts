import { describe, expect, it, vi } from 'vitest';

import { renderWithContext } from '@/test/render';

import { NightStepper, type NightStepperProps } from './NightStepper';

function renderStepper(overrides: Partial<NightStepperProps> = {}) {
  const props: NightStepperProps = {
    value: '2025-11-13',
    onChange: vi.fn(),
    onStep: vi.fn(),
    step: 1,
    dateLabel: 'Observing night',
    stepLabel: 'night',
    onTonight: vi.fn(),
    isTonight: false,
    ...overrides,
  };
  return renderWithContext(<NightStepper {...props} />);
}

describe(NightStepper, () => {
  it('should call onTonight when Tonight is pressed', async () => {
    const onTonight = vi.fn();
    const screen = await renderStepper({ onTonight });

    await screen.getByRole('button', { name: 'Tonight' }).click();

    expect(onTonight).toHaveBeenCalledTimes(1);
  });

  it('should disable Tonight when the view already sits on tonight', async () => {
    const screen = await renderStepper({ isTonight: true });

    await expect.element(screen.getByRole('button', { name: 'Tonight' })).toBeDisabled();
  });

  it.each([
    { arrow: 'Previous', days: -7 },
    { arrow: 'Next', days: 7 },
  ])('should call onStep with $days when $arrow week is pressed', async ({ arrow, days }) => {
    const onStep = vi.fn();
    const screen = await renderStepper({ onStep, step: 7, stepLabel: 'week' });

    await screen.getByRole('button', { name: `${arrow} week` }).click();

    expect(onStep).toHaveBeenCalledExactlyOnceWith(days);
  });

  it('should show the value under the date label when rendered', async () => {
    const screen = await renderStepper({ value: '2025-11-13', dateLabel: 'First evening' });

    await expect.element(screen.getByLabelText('First evening')).toHaveValue('2025-11-13');
  });

  it('should report the typed date through onChange when a date is entered', async () => {
    const onChange = vi.fn();
    const screen = await renderStepper({ onChange });

    await screen.getByLabelText('Observing night').fill('2025-12-15');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2025-12-15');
  });

  it('should not call onChange when the input is cleared', async () => {
    const onChange = vi.fn();
    const screen = await renderStepper({ onChange });

    await screen.getByLabelText('Observing night').fill('');

    await expect.element(screen.getByLabelText('Observing night')).toHaveValue('2025-11-13');
    expect(onChange).not.toHaveBeenCalled();
  });
});
