import { type JSX, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { renderWithContext } from '@/test/render';

import { type Decision, type ReviewItem, ReviewView } from './ReviewView';

interface Item extends ReviewItem {
  readonly name: string;
}

const items: readonly Item[] = [
  { id: 'a', name: 'First', resolved: false, observations: [] },
  { id: 'b', name: 'Second', resolved: false, observations: [] },
];

/** The view as a page drives it, listing each returned resolve for tests to wait on.
 *  `unlocked` leaves the decision open during a resolve, as a page must not. */
function Harness({
  onResolve,
  resolveBlocked,
  unlocked = false,
}: {
  readonly onResolve: (item: Item) => Promise<boolean>;
  readonly resolveBlocked?: (decision: Decision) => string | null;
  readonly unlocked?: boolean;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState<string>('a');
  const [returned, setReturned] = useState<readonly string[]>([]);
  const [resolving, setResolving] = useState(false);
  return (
    <>
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
        resolving={resolving && !unlocked}
        onResolve={async (item) => {
          setResolving(true);
          const ok = await onResolve(item);
          setResolving(false);
          setReturned((r) => [...r, item.id]);
          return ok;
        }}
        resolveBlocked={resolveBlocked}
        detailTitle={(i) => `Detail of ${i.name}`}
        noun="thing"
        resolveMutation="resolveThing"
      />
      <output data-testid="returned">{returned.join(',')}</output>
    </>
  );
}

describe(ReviewView, () => {
  it('seeds the response on a decision and clears it when the selection moves', async () => {
    const screen = await renderWithContext(<Harness onResolve={vi.fn().mockResolvedValue(true)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await expect.element(screen.getByRole('textbox')).toHaveValue('ACCEPT First');

    await userEvent.click(screen.getByRole('cell', { name: 'Second' }));
    await expect.element(screen.getByRole('textbox')).toHaveValue('');
  });

  it('clears the draft once its resolve succeeds', async () => {
    const screen = await renderWithContext(<Harness onResolve={vi.fn().mockResolvedValue(true)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await expect.element(screen.getByRole('textbox')).toHaveValue('');
  });

  it('keeps the draft when its resolve fails', async () => {
    const screen = await renderWithContext(<Harness onResolve={vi.fn().mockResolvedValue(false)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await expect.element(screen.getByTestId('returned')).toHaveTextContent('a');
    await expect.element(screen.getByRole('textbox')).toHaveValue('ACCEPT First');
  });

  it('keeps the current draft when an earlier resolve succeeds late', async () => {
    const first = Promise.withResolvers<boolean>();
    const onResolve = vi.fn<(item: Item) => Promise<boolean>>().mockReturnValueOnce(first.promise);
    // Unlocked, so the newer draft can exist at all.
    const screen = await renderWithContext(<Harness onResolve={onResolve} unlocked />);

    // Resolve the first item, then move on to the second and start a draft there while it is still in flight.
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await userEvent.click(screen.getByRole('cell', { name: 'Second' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await expect.element(screen.getByRole('textbox')).toHaveValue('REJECT Second');

    first.resolve(true);
    // Wait until it has landed, so the check below can't pass by running first.
    await expect.element(screen.getByTestId('returned')).toHaveTextContent('a');
    await expect.element(screen.getByRole('textbox')).toHaveValue('REJECT Second');
    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it('locks the decision on the same item until an earlier resolve lands', async () => {
    const first = Promise.withResolvers<boolean>();
    const onResolve = vi.fn<(item: Item) => Promise<boolean>>().mockReturnValueOnce(first.promise);
    const screen = await renderWithContext(<Harness onResolve={onResolve} />);

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await userEvent.click(screen.getByRole('cell', { name: 'Second' }));
    await userEvent.click(screen.getByRole('cell', { name: 'First' }));
    await expect.element(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

    first.resolve(true);
    await expect.element(screen.getByTestId('returned')).toHaveTextContent('a');
    await expect.element(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
    await expect.element(screen.getByRole('textbox')).toHaveValue('');
  });

  it('disables Resolve with the reason while the decision is blocked', async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const screen = await renderWithContext(
      <Harness onResolve={onResolve} resolveBlocked={(decision) => (decision === 'ACCEPT' ? 'Not yet.' : null)} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await expect.element(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled();
    await expect.element(screen.getByTitle('Not yet.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await expect.element(screen.getByRole('button', { name: 'Resolve' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(onResolve).toHaveBeenCalledTimes(1);
  });
});
