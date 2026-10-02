import '@/styles/global.css';
import '@/styles/main.css';

import { describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { contrastRatio, pixelOver } from '@/test/styleProbe';

import { Loading } from './PageStatus';

const renderLoading = async () => {
  const screen = await render(<Loading what="the catalog" />);
  const line = screen.getByText('Loading the catalog…').element();
  return { line, glyph: screen.container.querySelector('svg')! };
};

const canvas = () => pixelOver(getComputedStyle(document.body).backgroundColor, 'rgb(0 0 0)');

const setMotion = (value: string) =>
  cdp().send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value },
      { name: 'prefers-color-scheme', value: 'light' },
    ],
  });

const opacityAt = (ms: number, box: HTMLElement): number => {
  const appear = box.getAnimations().find((animation) => (animation as CSSAnimation).animationName === 'loader-appear');
  expect(appear, 'the loader carries its appear animation').toBeDefined();
  appear!.pause();
  appear!.currentTime = ms;
  return Number(getComputedStyle(box).opacity);
};

describe(Loading, () => {
  it('stays invisible for its first 300 ms, then fades in, the mark hopping without end', async () => {
    await setMotion('no-preference');
    try {
      const { line, glyph } = await renderLoading();
      const box = line.parentElement!;

      expect(opacityAt(299, box)).toBe(0);
      expect(opacityAt(400, box)).toBeGreaterThan(0);
      expect(opacityAt(400, box)).toBeLessThan(1);
      expect(opacityAt(500, box)).toBe(1);
      expect(getComputedStyle(glyph).animationName).toBe('loader-hop');
      expect(getComputedStyle(glyph).animationIterationCount).toBe('infinite');
    } finally {
      await setMotion('reduce');
    }
  });

  it('appears at once and holds the mark still under reduced motion', async () => {
    const { line, glyph } = await renderLoading();
    const box = line.parentElement!;

    expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    expect(getComputedStyle(box).animationName).toBe('none');
    expect(Number(getComputedStyle(box).opacity)).toBe(1);
    expect(getComputedStyle(glyph).animationName).toBe('none');
  });

  it('reads its words at 4.5:1 or better against the canvas they sit on', async () => {
    const { line } = await renderLoading();

    expect(
      contrastRatio(pixelOver(getComputedStyle(line).color, `rgb(${canvas().join(' ')})`), canvas()),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
