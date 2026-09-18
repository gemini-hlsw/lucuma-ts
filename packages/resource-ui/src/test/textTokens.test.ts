/** Tailwind's own compiler reads the roles, so a token added to `@theme` cannot escape the guard. */
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { __unstable__loadDesignSystem } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import globalCss from '../styles/global.css?raw';

// Tailwind's own stylesheet would drag in every default token; only this app's `@theme` is in scope.
const designSystem = await __unstable__loadDesignSystem(globalCss.replace(/^@import\s+['"]tailwindcss['"];?$/m, ''));

// `--text-shadow-*` shares the `--text` prefix and is not a font size.
const shadowKeys = new Set(designSystem.theme.keysInNamespaces(['--text-shadow']).map((key) => `shadow-${key}`));
const declared = designSystem.theme.keysInNamespaces(['--text']).filter((key) => !shadowKeys.has(key));

function otherRole(role: string): string {
  const other = declared.find((key) => key !== role);
  if (other === undefined) {
    throw new Error(`The scale needs a second role for \`text-${role}\` to be merged against.`);
  }
  return other;
}

describe(cn, () => {
  it.each(declared)('reads text-%s as a size, so two sizes collapse to the later one', (role) => {
    expect(cn(`text-${otherRole(role)}`, `text-${role}`)).toBe(`text-${role}`);
  });

  it.each(declared)('keeps text-%s through a following colour', (role) => {
    expect(cn(`text-${role}`, 'text-foreground-secondary')).toContain(`text-${role}`);
  });
});
