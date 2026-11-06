import type { renderWithContext } from './render';

type Screen = Awaited<ReturnType<typeof renderWithContext>>;

/** The row checkboxes of a configuration request table, in row order. */
export const rowBoxes = (screen: Screen) => [
  ...screen.container.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'),
];

/** Whether each row is ticked, in row order. */
export const ticks = (screen: Screen) => rowBoxes(screen).map((box) => box.checked);

/** One request's checkbox. Its accessible name flips with the state, so it is found by its row. */
export const boxOf = (screen: Screen, id: string) =>
  screen
    .getByRole('row', { name: new RegExp(id) })
    .getByRole('checkbox')
    .last();
