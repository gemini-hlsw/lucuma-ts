import { expect } from 'vitest';
import { type LocatorSelectors, page, userEvent } from 'vitest/browser';

export async function chooseSite(sut: LocatorSelectors, site: 'GN' | 'GS'): Promise<void> {
  await sut.getByRole('button', { name: site === 'GN' ? 'Gemini North' : 'Gemini South' }).click();
}

export async function openAppMenu(sut: LocatorSelectors): Promise<void> {
  await sut.getByRole('button', { name: 'Menu' }).click();
  await expect.element(page.getByRole('menuitem', { name: 'About Resource' })).toBeVisible();
}

/**
 * The clock is a menu choice now, so every test that moves it opens the menu the reader opens.
 * Choosing closes the menu, so a test asserting the new state must open it again.
 */
export async function chooseClock(sut: LocatorSelectors, label: 'Site time' | 'UTC'): Promise<void> {
  await openAppMenu(sut);
  const choice = page.getByRole('menuitemradio', { name: `Clock: ${label}`, exact: true });
  await expect.element(choice).toBeVisible();
  await userEvent.click(choice);
}

export const nightAxisLabels = (): string[] =>
  [...document.querySelectorAll('[data-testid="night-timeline"] .highcharts-xaxis-labels text')].map(
    (tick) => tick.textContent ?? '',
  );

/** Highcharts keeps a plot line it will not draw as a hidden or path-less element, so presence proves nothing. */
export const drawnPlotLineX = (selector: string): number[] =>
  [...document.querySelectorAll<SVGPathElement>(`.highcharts-plot-line${selector}`)]
    .filter((line) => line.getAttribute('d') !== null && getComputedStyle(line).visibility !== 'hidden')
    .map((line) => Number(/M\s*([\d.]+)/u.exec(line.getAttribute('d') ?? '')?.[1]));
