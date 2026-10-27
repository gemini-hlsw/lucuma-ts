import { render } from 'vitest-browser-react';

import { Check, CircleCheck, iconFactory, Info } from './Icons.tsx';

describe(iconFactory, () => {
  it('renders an svg tagged with the icon name', async () => {
    const { container } = await render(<CircleCheck />);

    await expect.poll(() => container.querySelector('svg')?.getAttribute('data-icon')).toBe('circle-check');
  });

  it('passes props through to the svg', async () => {
    const { container } = await render(<Info className="text-test" aria-hidden="true" />);

    await expect.poll(() => container.querySelector('svg')?.getAttribute('data-icon')).toBe('circle-info');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('svg')?.classList.contains('text-test')).toBe(true);
  });

  it('names components PascalCase + Icon', () => {
    expect(Check.displayName).toBe('CheckIcon');
    expect(CircleCheck.displayName).toBe('CircleCheckIcon');
  });
});
