/**
 * The pixel geometry one month of the semester is drawn at, in either view.
 *
 * `/semester` toggles between an xrange month chart (`semesterMonthOptions.ts`)
 * and the cell grid (`semesterHeatmapOptions.ts`). They are the same page's two
 * readings of the same rows, one toggle apart, so a reader flipping between
 * them sees the row heights, the label gutter and the day numbering hold still.
 * Both files carried their own copy of every number here - byte-identical, and
 * with two byte-identical width functions on top of that - which is the state
 * immediately before a drift. CLAUDE.md names the precedent by name: the DOM
 * table the grid replaced "kept its own copy of the domain model, was frozen
 * three commits behind, and had silently drifted", and the rule taken from it is
 * **do not give a view its own path from records to pixels**. This module is
 * that path, once, for the pair.
 *
 * `LABEL_GUTTER` is load-bearing beyond layout: CLAUDE.md records that the group
 * heading type "is sized to fit the narrowest 92px gutter", so changing it here
 * without re-checking the heading type breaks a documented measurement.
 *
 * The night and week charts keep their own geometry (`nightChartOptions.ts`,
 * `weekChartOptions.ts`). They serve different windows with different label
 * lengths and no page reads both, so their agreement with each other - where it
 * exists - is coincidence, not coupling.
 */

/** Height of one row, headings and data rows alike. */
export const ROW_HEIGHT = 26;

/** Room below the plot area, where the day numbers sit. */
export const BOTTOM_MARGIN = 26;

/** Width of the left gutter the row labels are drawn in. */
export const LABEL_GUTTER = 92;

/**
 * Room a two-digit day number needs, and the widths a month therefore needs to
 * number every night or every other one. Derived from the night count rather
 * than fixed, because a 28-night February fits numbers a 31-night August cannot.
 */
const PX_PER_LABEL = 15;
const PX_PER_LABEL_TIGHT = 8;

export const widthForEveryNight = (nightCount: number): number => nightCount * PX_PER_LABEL;
export const widthForEveryOtherNight = (nightCount: number): number => nightCount * PX_PER_LABEL_TIGHT;
