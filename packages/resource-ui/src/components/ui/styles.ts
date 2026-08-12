/**
 * Shared class constants for the Resource green accent and interaction states.
 *
 * Green is the single primary interaction / selection / active color; defining it once
 * here keeps it intentional and prevents scattered, inconsistent green combinations.
 * Semantic colors stay fixed elsewhere: red = closed / unavailable / destructive,
 * amber = warning / unknown / conflict, neutral = inactive / archived / secondary.
 */

/** Visible keyboard focus for any interactive element. */
export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gpp';

/** A selected date tile in the calendar heat-map. */
export const TILE_SELECTED = 'ring-2 ring-gpp';

/** A selected row / strip (lighter than a tile). */
export const ROW_SELECTED = 'border-gpp ring-1 ring-gpp';

/** A compact bordered panel surface. */
export const PANEL = 'rounded border border-subtle bg-surface';
