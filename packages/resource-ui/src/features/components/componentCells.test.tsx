import { describe, expect, it } from 'vitest';

import type { FinderRow } from '@/domain/componentFinder';
import { domainInstrumentComponent } from '@/test/fixtures/domain';
import { renderWithContext } from '@/test/render';

import { ComponentIdentityCell, StatusCell } from './componentCells';

const row = (over: Partial<FinderRow> = {}, component: Partial<FinderRow['component']> = {}): FinderRow => ({
  component: domainInstrumentComponent(component),
  where: { kind: 'STORED', location: 'LAB' },
  usage: 'UNAVAILABLE',
  note: null,
  changesTonight: false,
  transitions: [],
  ...over,
});

describe(ComponentIdentityCell, () => {
  it('should show the name and the code with its barcode when the piece has one', async () => {
    const screen = await renderWithContext(
      <ComponentIdentityCell row={row({}, { code: 'GS2026B-011', name: 'Mask GS2026B-011', barcode: '11002801' })} />,
    );

    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText('GS2026B-011 · barcode 11002801')).toBeVisible();
  });

  it('should show the code alone when the piece has no barcode', async () => {
    const screen = await renderWithContext(<ComponentIdentityCell row={row()} />);

    await expect.element(screen.getByText('R400')).toBeVisible();
    await expect.element(screen.getByText('R400_G5325')).toBeVisible();
    await expect.element(screen.getByText(/barcode/)).not.toBeInTheDocument();
  });
});

describe(StatusCell, () => {
  it('should read Spare and never Unavailable when a stored piece has no note', async () => {
    const screen = await renderWithContext(<StatusCell row={row()} />);

    await expect.element(screen.getByText('Spare')).toBeVisible();
    await expect.element(screen.getByText('Unavailable')).not.toBeInTheDocument();
  });

  it('should read Unavailable as the badge alone when a stored piece carries a note', async () => {
    const screen = await renderWithContext(<StatusCell row={row({ note: 'Failed; removed for repair' })} />);

    await expect.element(screen.getByText('Unavailable')).toBeVisible();
    expect(screen.container.textContent).toBe('Unavailable');
  });

  it('should render nothing when the piece has no record', async () => {
    const screen = await renderWithContext(<StatusCell row={row({ where: { kind: 'NOT_RECORDED' }, usage: null })} />);

    expect(screen.container.textContent).toBe('');
  });
});
