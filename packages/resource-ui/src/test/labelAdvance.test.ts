/*
 * The label-fit constants, measured rather than mirrored: nothing else in the repo states them, so
 * what can be tested is the claim they make. Each one has to over-predict the type it stands for, or
 * a label that does not fit gets drawn and clips.
 *
 * A pixel budget spent in the wrong face measures nothing, so this file loads the app's styling for
 * its font stack, like `SemesterTimeline.test.tsx`.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import { beforeAll, describe, expect, it } from 'vitest';

import { portRowLabel, TELESCOPE_PORTS } from '@/domain/ports';
import {
  MODE_ROW_LABEL,
  SUBSYSTEM_ROW_LABEL,
  SUBSYSTEM_USAGE_LABEL,
  TELESCOPE_AVAILABILITY_LABEL,
  TELESCOPE_MODE_LABEL,
  TELESCOPE_ROW_LABEL,
  TOO_ROW_LABEL,
  TOO_SUPPORT_LABEL,
  USAGE_LABEL,
} from '@/domain/timeline';
import { pxPerLabel, pxPerLabelTight } from '@/features/semester/semesterMonthOptions';
import {
  CHART_LABEL,
  CLOSURE_LABEL,
  DENSE,
  GUTTER_HEADINGS,
  gutterTextWidth,
  HEADING_LABEL,
  INSTRUMENT_LABEL,
  LABEL_ADVANCE_PER_REM,
  TICK,
  UNSCHEDULED_LABEL,
} from '@/features/timeline/timelineOptions';
import { advancePerRem, textWidth } from '@/test/styleProbe';

/**
 * A closure's reason is the one label that is not drawn from an enum: it is freeform text on the
 * record (`Closure.reason`), and it reaches both a bar label and a band label through the same
 * estimate. These are the workbook's own phrasings, so the bound is measured against the shape real
 * records take.
 */
const CLOSURE_REASONS = [
  'Telescope Shutdown A&G Maintenance',
  'Telescope Shutdown',
  'In-Situ Wash',
  'Realuminization',
  'Shutdown',
];

/** Drawn from the label maps, so an instrument added to the schema is measured without being listed. */
const CHART_LABELS = [
  ...Object.values(INSTRUMENT_LABEL),
  ...Object.values(SUBSYSTEM_ROW_LABEL),
  ...Object.values(SUBSYSTEM_USAGE_LABEL),
  ...Object.values(USAGE_LABEL),
  ...Object.values(TELESCOPE_MODE_LABEL),
  ...Object.values(TOO_SUPPORT_LABEL),
  ...Object.values(TELESCOPE_AVAILABILITY_LABEL),
  ...CLOSURE_REASONS,
  UNSCHEDULED_LABEL,
  CLOSURE_LABEL,
];

/** A two-digit day is the widest a day-number tick gets. */
const WIDEST_DAY = '28';

/** The spacing WCAG 1.4.12 lets a reader impose, which replaces a label's own tracking rather than adding to it. */
const READER_LETTER_SPACING = '0.12em';

/** Every row label a view can put in the gutter; the group headings above it are the builder's own. */
const GUTTER_ROW_LABELS = [
  TELESCOPE_ROW_LABEL,
  MODE_ROW_LABEL,
  TOO_ROW_LABEL,
  ...Object.values(SUBSYSTEM_ROW_LABEL),
  ...TELESCOPE_PORTS.map(portRowLabel),
];

beforeAll(() => {
  // The theme carries the font stack and is scoped under `.dark`, as `main.tsx` scopes it.
  document.documentElement.classList.add('dark');
});

describe('the chart label advance', () => {
  it('never predicts a label narrower than it draws', () => {
    expect(advancePerRem(CHART_LABELS, DENSE, '600')).toBeLessThanOrEqual(LABEL_ADVANCE_PER_REM);
  });

  /*
   * An advance per character cannot bound arbitrary text: a string of the widest glyph beats any
   * constant a real label would justify. This records where the estimate stops being conservative,
   * so a freeform reason full of capitals is a known limit rather than a surprise.
   */
  it('is knowingly beaten by a string of the widest glyph', () => {
    expect(advancePerRem(['WWWWWWWW'], DENSE, '600')).toBeGreaterThan(LABEL_ADVANCE_PER_REM);
  });
});

describe('the day-number tick budget', () => {
  it('holds a two-digit day at every night', () => {
    expect(textWidth(WIDEST_DAY, TICK, '400')).toBeLessThanOrEqual(pxPerLabel());
  });

  // At the tight step only every second night draws, so a label owns two slots.
  it('holds a two-digit day at every other night', () => {
    expect(textWidth(WIDEST_DAY, TICK, '400')).toBeLessThanOrEqual(pxPerLabelTight() * 2);
  });
});

/*
 * The gutter is the one width in the app that is derived rather than declared, because Highcharts'
 * `marginLeft` switches off its own label-aware sizing. What it has to hold is measured here, at the
 * letter-spacing a reader may impose, so the budget cannot be spent by rewording a heading.
 */
describe('the chart label gutter', () => {
  it.each([...GUTTER_HEADINGS])('holds the %s heading under a reader letter spacing', (heading) => {
    const width = textWidth(
      heading.toUpperCase(),
      HEADING_LABEL.fontSize,
      HEADING_LABEL.fontWeight,
      READER_LETTER_SPACING,
    );
    expect(width).toBeLessThanOrEqual(gutterTextWidth());
  });

  it.each(GUTTER_ROW_LABELS)('holds the %s row label under a reader letter spacing', (label) => {
    const width = textWidth(label, CHART_LABEL.fontSize, CHART_LABEL.fontWeight, READER_LETTER_SPACING);
    expect(width).toBeLessThanOrEqual(gutterTextWidth());
  });
});
