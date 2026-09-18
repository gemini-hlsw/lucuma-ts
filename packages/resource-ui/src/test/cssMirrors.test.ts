/*
 * Values the stylesheet owns that code restates, pinned to the stylesheet itself. Every case here
 * fails silently in the app: a chart keeps its old size, a `var()` naming nothing draws nothing, an
 * ink stays legible only against the hex it was measured on.
 *
 * Read as text, never loaded into the page, so the package's no-app-stylesheet rule is untouched.
 */
import { __unstable__loadDesignSystem } from 'tailwindcss';
import tailwindTheme from 'tailwindcss/theme.css?raw';
import { describe, expect, it } from 'vitest';

import type { Instrument } from '@/domain/types';
import { DENSE, INSTRUMENT_LABEL, instrumentColor, instrumentInk, TICK } from '@/features/timeline/timelineOptions';
import { contrastRatio, pixelOver } from '@/test/styleProbe';

import globalCss from '../styles/global.css?raw';
import shellCss from '../styles/shell.css?raw';

// Tailwind's defaults arrive as the imported stylesheet, so an app `@theme` override wins over them.
const designSystem = await __unstable__loadDesignSystem(globalCss, {
  loadStylesheet: (path: string, base: string) => Promise.resolve({ path, base, content: tailwindTheme }),
});

type CustomProperty = `--${string}`;

/** Custom properties declared outside `@theme` - the design system resolves only what `@theme` holds. */
const plainProperties = new Map(
  [...`${globalCss}\n${shellCss}`.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gmu)].map(
    (match) => [match[1] as CustomProperty, match[2]!.trim()] as const,
  ),
);

const declared = (name: CustomProperty): string | null =>
  designSystem.theme.get([name]) ?? plainProperties.get(name) ?? null;

/** Follows a `var(--a)` chain to the literal it ends at, so an alias is not mistaken for a colour. */
const literal = (value: string): string => {
  const alias = /^var\((--[a-z0-9-]+)\)$/u.exec(value.trim());
  const target = alias === null ? null : declared(alias[1] as CustomProperty);
  return target === null ? value.trim() : literal(target);
};

describe('the type sizes the charts mirror', () => {
  // Highcharts measures in px and cannot read a var(), so timelineOptions restates these two.
  it.each<readonly [CustomProperty, string]>([
    ['--text-xs', DENSE],
    ['--text-2xs', TICK],
  ])('keeps %s and its chart copy at one size', (token, mirrored) => {
    expect(mirrored).toBe(declared(token));
  });
});

describe('every custom property the code names', () => {
  const sources: Record<string, string> = import.meta.glob('/src/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  /** Prose names properties it is explaining rather than using, so a comment is not a reference. */
  const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gmu, '');

  const referenced = [
    ...new Set(
      Object.entries(sources)
        .filter(([path]) => !path.includes('/gen/') && !path.endsWith('cssMirrors.test.ts'))
        .flatMap(([, source]) =>
          [...code(source).matchAll(/var\((--[a-z0-9-]+)\)/gu)].map((match) => match[1] as CustomProperty),
        ),
    ),
  ].sort();

  it('finds the references - a broken sweep would pin nothing', () => {
    expect(referenced.length).toBeGreaterThan(30);
  });

  // Only the bare form: `var(--x)` naming nothing draws nothing, which is the failure being caught.
  it.each(referenced)('%s is defined in the stylesheet', (name) => {
    expect(declared(name)).not.toBeNull();
  });

  /*
   * The other half of the same rule. `var(--x, fallback)` is allowed to name nothing - a themable
   * hook with a default, as the moon disc uses - but only while the fallback is really there, since
   * an empty one is the bare form wearing a comma.
   */
  const withFallback = Object.entries(sources)
    .filter(([path]) => !path.includes('/gen/') && !path.endsWith('cssMirrors.test.ts'))
    .flatMap(([path, source]) =>
      [...code(source).matchAll(/var\((--[a-z0-9-]+),([^)]*)\)/gu)].map(
        (match) => [`${path.split('/').pop() ?? path} ${match[1]!}`, match[2]!] as const,
      ),
    );

  it.each(withFallback)('%s falls back to something', (_where, fallback) => {
    expect(fallback.trim()).not.toBe('');
  });
});

describe('the ink chosen per instrument', () => {
  // Keyed by the enum, so an instrument added to the schema arrives here with its colour.
  const instruments = Object.keys(INSTRUMENT_LABEL) as Instrument[];

  it.each(instruments)('%s carries an ink that clears 4.5:1 on its own fill', (instrument) => {
    // Opaque hex either side, so compositing over black is the colour itself.
    const fill = pixelOver(literal(instrumentColor(instrument)), '#000');
    const ink = pixelOver(literal(instrumentInk(instrument)), '#000');

    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the alert panels', () => {
  // Each family is a fill with an ink meant to be read on it; nothing else states that pairing.
  it.each([
    ['warning', '--color-warning-fill', '--color-warning-ink'],
    ['danger', '--color-danger-fill', '--color-danger-ink'],
  ] as const)('%s ink clears 4.5:1 on its own fill', (_family, fill, ink) => {
    const over = (token: CustomProperty) => pixelOver(declared(token) ?? '', '#000');

    expect(contrastRatio(over(ink), over(fill))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the foreground tones', () => {
  const surfaces = [
    '--color-canvas',
    '--color-surface',
    '--color-panel',
    '--color-panel-header',
    '--color-surface-raised',
  ] as const satisfies readonly CustomProperty[];

  const ratio = (ink: CustomProperty, surface: CustomProperty): number => {
    const backdrop = declared(surface) ?? '';
    return contrastRatio(pixelOver(declared(ink) ?? '', backdrop), pixelOver(backdrop, '#000'));
  };

  const informative = (['--color-foreground', '--color-foreground-secondary'] as const).flatMap((ink) =>
    surfaces.map((surface) => [ink, surface] as const),
  );

  it.each(informative)('%s clears 4.5:1 on %s', (ink, surface) => {
    expect(ratio(ink, surface)).toBeGreaterThanOrEqual(4.5);
  });

  // Pinned from below on purpose: muted is decoration-only because it cannot be read at any size.
  it.each(surfaces)('--color-foreground-muted stays under 4.5:1 on %s', (surface) => {
    expect(ratio('--color-foreground-muted', surface)).toBeLessThan(4.5);
  });
});

describe('the masthead breakpoint', () => {
  it('switches at the same width as the `md:` utilities beside it', () => {
    const query = /@media \(width < ([0-9.]+rem)\)/u.exec(shellCss);

    expect(query?.[1]).toBe(designSystem.theme.get(['--breakpoint-md']));
  });
});
