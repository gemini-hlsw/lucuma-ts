import { type JSX, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { renderWithContext } from '@/test/render';

import { type ReviewItem, ReviewView } from './ReviewView';

interface Item extends ReviewItem {
  readonly name: string;
}

const items: readonly Item[] = [
  { id: 'a', name: 'First', resolved: false, observations: [] },
  { id: 'b', name: 'Second', resolved: false, observations: [] },
];

/** The view as a page drives it: the page owns which item is selected. */
function Harness({ onResolve }: { readonly onResolve: (item: Item) => Promise<boolean> }): JSX.Element {
  const [selectedId, setSelectedId] = useState<string>('a');
  return (
    <ReviewView<Item>
      title="Things"
      blurb="Review the things."
      badge={null}
      items={items}
      selected={items.find((i) => i.id === selectedId) ?? null}
      onSelect={(id) => setSelectedId(id ?? '')}
      columns={[{ header: 'Name', value: (i) => i.name }]}
      renderDetail={() => null}
      boilerplate={(i, decision) => `${decision} ${i.name}`}
      onResolve={onResolve}
      detailTitle={(i) => `Detail of ${i.name}`}
      noun="thing"
      resolveMutation="resolveThing"
    />
  );
}

describe(ReviewView, () => {
  it('seeds the response when a decision is chosen, and clears it when the selection moves', async () => {
    const screen = await renderWithContext(<Harness onResolve={vi.fn().mockResolvedValue(true)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await expect.element(screen.getByRole('textbox')).toHaveValue('ACCEPT First');

    await userEvent.click(screen.getByRole('cell', { name: 'Second' }));
    await expect.element(screen.getByRole('textbox')).toHaveValue('');
  });

  it('keeps the draft of the item now on screen when an earlier resolve succeeds late', async () => {
    let finishFirst: (ok: boolean) => void = () => undefined;
    const onResolve = vi
      .fn<(item: Item) => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => (finishFirst = resolve)));
    const screen = await renderWithContext(<Harness onResolve={onResolve} />);

    // Resolve the first item, then move on to the second and start a draft there while it is still in flight.
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await userEvent.click(screen.getByRole('cell', { name: 'Second' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await expect.element(screen.getByRole('textbox')).toHaveValue('REJECT Second');

    finishFirst(true);
    // Give the late success time to land: a check made at once could pass before it clears anything.
    await new Promise((resolve) => setTimeout(resolve, 300));
    // The first item's success must leave the second item's draft alone.
    expect(onResolve).toHaveBeenCalledTimes(1);
    await expect.element(screen.getByRole('textbox')).toHaveValue('REJECT Second');
  });
});
