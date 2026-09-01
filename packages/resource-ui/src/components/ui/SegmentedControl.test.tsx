import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { SegmentedControl } from './SegmentedControl';

type View = 'night' | 'week' | 'semester';

const OPTIONS = [
  { label: 'Night', value: 'night' },
  { label: 'Week', value: 'week' },
  { label: 'Semester', value: 'semester' },
] as const;

describe(SegmentedControl, () => {
  it('marks exactly one option selected and reports the group role', async () => {
    const screen = await render(
      <SegmentedControl ariaLabel="View" value="week" options={OPTIONS} onChange={vi.fn()} />,
    );
    await expect.element(screen.getByRole('group', { name: 'View' })).toBeVisible();

    await expect.element(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'false');
    await expect.element(screen.getByRole('button', { name: 'Semester' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked value', async () => {
    const onChange = vi.fn<(v: View) => void>();
    const screen = await render(
      <SegmentedControl ariaLabel="View" value="week" options={OPTIONS} onChange={onChange} />,
    );
    await screen.getByRole('button', { name: 'Semester' }).click();
    expect(onChange).toHaveBeenCalledWith('semester');
  });

  it('selects the focused segment with the keyboard', async () => {
    // SelectButton's toolbar pattern: arrows move focus, Space selects.
    const onChange = vi.fn<(v: View) => void>();
    const screen = await render(
      <SegmentedControl ariaLabel="View" value="week" options={OPTIONS} onChange={onChange} />,
    );
    const night = screen.getByRole('button', { name: 'Night' }).element() as HTMLElement;
    night.focus();
    night.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('night');
  });

  it('honours an ariaLabel override for abbreviated labels', async () => {
    const screen = await render(
      <SegmentedControl
        ariaLabel="Site"
        value="GN"
        options={[
          { label: 'GN', value: 'GN', ariaLabel: 'Gemini North' },
          { label: 'GS', value: 'GS', ariaLabel: 'Gemini South' },
        ]}
        onChange={vi.fn()}
      />,
    );
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toBeVisible();
  });
});
