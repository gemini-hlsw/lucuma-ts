/** Tailwind's own compiler reads the roles, so a token added to `@theme` cannot escape the guard. */
import { __unstable__loadDesignSystem } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import { cn, FONT_SIZE_NAMES } from '@/styles/cn';

import globalCss from '../styles/global.css?raw';

// Tailwind's own stylesheet would drag in every default token; only this app's `@theme` is in scope.
const designSystem = await __unstable__loadDesignSystem(globalCss.replace(/^@import\s+['"]tailwindcss['"];?$/m, ''));

// `--text-shadow-*` shares the `--text` prefix and is not a font size.
const shadowKeys = new Set(designSystem.theme.keysInNamespaces(['--text-shadow']).map((key) => `shadow-${key}`));
const declared = designSystem.theme.keysInNamespaces(['--text']).filter((key) => !shadowKeys.has(key));

describe('the font-size roles in global.css', () => {
  it('is the list `cn` was built from - an unlisted role merges as a colour', () => {
    expect([...declared].sort()).toStrictEqual([...FONT_SIZE_NAMES].sort());
  });

  it.each(declared)('survives a following colour: text-%s', (key) => {
    expect(cn(`text-${key}`, 'text-foreground-secondary')).toContain(`text-${key}`);
  });
});
