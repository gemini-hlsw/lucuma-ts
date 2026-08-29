/**
 * Green is the single primary interaction / selection / active color, defined once here so
 * greens cannot drift apart across call sites. Semantic colors stay fixed elsewhere:
 * red = closed / unavailable / destructive, amber = warning / unknown / conflict,
 * neutral = inactive / archived / secondary.
 */

/** Visible keyboard focus for any interactive element. */
export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gpp';
