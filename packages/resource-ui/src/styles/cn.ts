import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The `@theme` font-size tokens, restated because tailwind-merge classifies `text-*` from the name
 * alone: a token it does not recognise as a size reads as a colour, and the size is dropped from
 * the merge with nothing to show for it. `src/test/textTokens.test.ts` pins this to `global.css`.
 */
export const FONT_SIZE_NAMES = ['2xs', 'xs', 'sm', 'base'] as const;

/** `cn` for this app; the shared one in `@gemini-hlsw/lucuma-common-ui` cannot see the scale above. */
export const cn = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: [...FONT_SIZE_NAMES] }] } },
});
