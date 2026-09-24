import '@/styles/global.css';
import '@/styles/main.css';

import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { renderApp } from '@/test/renderApp';
import { contrastRatio, pixelOver } from '@/test/styleProbe';

import Navbar from './Navbar';

const DESKTOP = { width: 1024, height: 768 };

const renderAtDesktop = async () => {
  await page.viewport(DESKTOP.width, DESKTOP.height);
  return renderApp({ element: <Navbar />, route: '/night?site=GS' });
};

const centre = (rect: DOMRect): [number, number] => [rect.left + rect.width / 2, rect.top + rect.height / 2];

describe(Navbar, () => {
  beforeAll(() => {
    document.documentElement.classList.add('dark');
  });

  it('centres the menu glyph in its 28px button', async () => {
    const screen = await renderAtDesktop();

    const button = screen.getByRole('button', { name: 'Menu' }).element();
    const glyph = button.querySelector('svg')!;
    const [buttonX, buttonY] = centre(button.getBoundingClientRect());
    const [glyphX, glyphY] = centre(glyph.getBoundingClientRect());

    expect(button.getBoundingClientRect().width).toBe(28);
    expect(button.getBoundingClientRect().height).toBe(28);
    expect(glyphX).toBeCloseTo(buttonX, 0);
    expect(glyphY).toBeCloseTo(buttonY, 0);
  });

  it('rings the keyboard-focused menu item at 3:1 or better against the row it paints over', async () => {
    const screen = await renderAtDesktop();

    (screen.getByRole('button', { name: 'Menu' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    const focused = page.getByRole('menuitem', { name: 'About Resource' });
    await expect.element(focused).toHaveClass('p-focus');
    const list = page.getByRole('menu').element();
    expect(document.activeElement).toBe(list);
    expect(list.matches(':focus-visible')).toBe(true);

    const menu = list.closest('.p-menu')!;
    const surface = pixelOver(getComputedStyle(menu).backgroundColor, getComputedStyle(document.body).backgroundColor);
    const row = getComputedStyle(focused.element().querySelector('.p-menuitem-content')!);
    const backdrop = pixelOver(row.backgroundColor, `rgb(${surface.join(' ')})`);
    const ring = pixelOver(row.outlineColor, `rgb(${backdrop.join(' ')})`);
    expect(row.outlineStyle).toBe('solid');
    expect(Number.parseFloat(row.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(contrastRatio(ring, backdrop)).toBeGreaterThanOrEqual(3);
  });

  it('leaves the ring off a menu item the pointer merely hovers', async () => {
    const screen = await renderAtDesktop();

    await screen.getByRole('button', { name: 'Menu' }).click();
    const hovered = page.getByRole('menuitemradio', { name: 'Clock: UTC', exact: true });
    await expect.element(hovered).toBeVisible();
    await userEvent.hover(hovered);
    await expect.element(hovered).toHaveClass('p-focus');

    expect(page.getByRole('menu').element().matches(':focus-visible')).toBe(false);
    expect(getComputedStyle(hovered.element().querySelector('.p-menuitem-content')!).outlineStyle).toBe('none');
  });
});
