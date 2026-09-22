import '@/styles/global.css';
import '@/styles/main.css';

import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import {
  contentBoxHeight,
  contrastRatio,
  lastTextLineRect,
  pixelOver,
  type Rgb,
  ROOT_FONT_SIZE,
} from '@/test/styleProbe';

import { AboutResource } from './AboutResource';

const DESKTOP = { width: 1024, height: 768 };

async function openDialog(): Promise<HTMLElement> {
  await page.viewport(DESKTOP.width, DESKTOP.height);
  await render(<AboutResource visible onHide={() => undefined} />);
  const dialog = page.getByTestId('about-resource');
  await expect.element(dialog).toBeVisible();
  return dialog.element() as HTMLElement;
}

function value(dialog: HTMLElement, caption: string): HTMLElement {
  const header = [...dialog.querySelectorAll('td[role="rowheader"]')].find((node) => node.textContent === caption);
  expect(header, `no ${caption} caption`).toBeDefined();
  return header!.nextElementSibling as HTMLElement;
}

function surfaceOf(dialog: HTMLElement): Rgb {
  const content = dialog.querySelector('.p-dialog-content')!;
  return pixelOver(getComputedStyle(content).backgroundColor, getComputedStyle(document.body).backgroundColor);
}

function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

describe(AboutResource, () => {
  beforeAll(() => {
    document.documentElement.classList.add('dark');
  });

  it('measures the panel in rem, so a raised reader font size widens it', async () => {
    const dialog = await openDialog();
    expect(getComputedStyle(document.documentElement).fontSize).toBe(ROOT_FONT_SIZE);
    const base = dialog.getBoundingClientRect().width;

    try {
      document.documentElement.style.fontSize = '20px';
      expect(dialog.getBoundingClientRect().width).toBeCloseTo(base * 1.25, 0);
    } finally {
      document.documentElement.style.removeProperty('font-size');
    }
  });

  it('keeps every word in the panel clear of the muted step', async () => {
    const dialog = await openDialog();
    const fill = surfaceOf(dialog);

    const words = [...dialog.querySelectorAll<HTMLElement>('p, td')];
    expect(words).toHaveLength(7);
    const dim = words.filter((word) => {
      const ink = pixelOver(getComputedStyle(word).color, `rgb(${fill[0]} ${fill[1]} ${fill[2]})`);
      return contrastRatio(ink, fill) < 4.5;
    });
    expect(dim.map((word) => word.textContent)).toEqual([]);
  });

  it('holds the version and its copy button on one line at 1024', async () => {
    const dialog = await openDialog();

    const row = value(dialog, 'Version');
    const button = row.querySelector('button')!.getBoundingClientRect();
    expect(contentBoxHeight(row)).toBeCloseTo(button.height, 0);
  });

  it.each([
    [320, 568],
    [390, 844],
  ])('keeps the copy button beside the version last token at %ix%i', async (width, height) => {
    await page.viewport(width, height);
    await render(<AboutResource visible onHide={() => undefined} />);
    const dialog = page.getByTestId('about-resource');
    await expect.element(dialog).toBeVisible();
    const panel = dialog.element() as HTMLElement;

    const row = value(panel, 'Version');
    const tail = lastTextLineRect(row);
    const button = panel.querySelector<HTMLElement>('button[aria-label="Copy version"]')!.getBoundingClientRect();

    expect(button.top).toBeLessThan(tail.bottom);
    expect(button.bottom).toBeGreaterThan(tail.top);
    expect(button.left).toBeGreaterThanOrEqual(tail.right);
    expect(button.height).toBe(28);
  });

  it('capitalises the environment without rewriting the word in the DOM', async () => {
    const dialog = await openDialog();

    const environment = value(dialog, 'Environment');
    expect(environment.textContent).toBe('development');
    expect(environment.innerText).toBe('Development');
  });

  it('dresses the captions as micro-labels while the DOM keeps their sentence case', async () => {
    const dialog = await openDialog();

    const caption = getComputedStyle(value(dialog, 'Endpoint').previousElementSibling!.querySelector('span')!);
    expect(caption.textTransform).toBe('uppercase');
    expect(caption.fontWeight).toBe('600');
  });

  it('sizes the caption column to the captions, not to the panel', async () => {
    const dialog = await openDialog();
    const caption = value(dialog, 'Endpoint').previousElementSibling as HTMLElement;
    const wide = caption.getBoundingClientRect().width;

    await page.viewport(390, 844);
    expect(caption.getBoundingClientRect().width).toBeCloseTo(wide, 0);
  });

  it('draws the header rule at 2px in the accent token, not a hardcoded colour', async () => {
    const dialog = await openDialog();

    const header = getComputedStyle(dialog.querySelector('.p-dialog-header')!);
    expect(header.borderBottomWidth).toBe('2px');
    expect(header.borderBottomColor).toBe(tokenColor('--color-gpp-accent'));
  });

  it('rings the copy button in the action-green token on keyboard focus, not merely differently', async () => {
    const dialog = await openDialog();
    const button = dialog.querySelector<HTMLElement>('button[aria-label="Copy version"]')!;
    button.blur();
    expect(getComputedStyle(button).outlineStyle).toBe('none');

    await userEvent.tab();
    button.focus();
    expect(button.matches(':focus-visible')).toBe(true);

    const focused = getComputedStyle(button);
    expect(focused.outlineStyle).toBe('solid');
    expect(focused.outlineWidth).toBe('2px');
    expect(pixelOver(focused.outlineColor, 'rgb(0 0 0)')).toEqual(
      pixelOver(tokenColor('--color-gpp-light'), 'rgb(0 0 0)'),
    );
    expect(focused.boxShadow).toBe('none');
  });
});
