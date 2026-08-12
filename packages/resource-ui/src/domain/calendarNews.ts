/**
 * The critical events a semester's records hold, one item per evening - what
 * the calendar draws instead of run bars (Dan, 2026-08-11).
 *
 * The calendar's job is the month's night facts - moon, dark hours, the week
 * rhythm - with the *happenings* on top: an instrument changing, the telescope
 * shutting or reopening. A run bar spanning weeks said nothing per square; a
 * chip on the evening something changes says exactly what a month page is for.
 * More kinds of news are expected to join this projection over time (component
 * failures are the obvious next one, once the semester query carries them).
 *
 * An instant is news only when it falls strictly inside the semester window:
 * a run or availability record reaching the window's own edge was there
 * before the page and after it, which is furniture, not news.
 */
import type { TimelineNight } from './timeline';
import { nightAt, USAGE_LABEL } from './timeline';
import type { Closure, Instrument, Mounting } from './types';

export type CalendarNewsKind =
  /** An instrument (or its usability) changes on a row this evening. */
  | 'INSTRUMENT'
  /** The telescope closes this evening. */
  | 'CLOSED'
  /** The telescope reopens this evening. */
  | 'OPEN';

export interface CalendarNewsItem {
  /** The evening the change takes effect - the square it belongs on. */
  readonly eveningDate: string;
  readonly kind: CalendarNewsKind;
  /** The chip's text, e.g. "IGRINS-2 → MAROON-X" or "GNIRS: Not available". */
  readonly label: string;
  /** The row the change is about; null for the telescope's own news. */
  readonly rowLabel: string | null;
  /** The incoming instrument, for the chip's hue; null for telescope news. */
  readonly instrument: Instrument | null;
  /** The closure reason or record note, for the tooltip. */
  readonly detail: string | null;
}

interface RowBoundary {
  readonly ending?: Mounting;
  readonly beginning?: Mounting;
}

/**
 * How one row's change is phrased, from what sits on either side of the
 * boundary: a swap names both instruments, a usability change names the new
 * usage, and a one-sided boundary says in or out.
 */
const phrase = ({ ending, beginning }: RowBoundary): string => {
  if (ending !== undefined && beginning !== undefined) {
    return ending.publishedName === beginning.publishedName
      ? `${beginning.publishedName}: ${USAGE_LABEL[beginning.usage]}`
      : `${ending.publishedName} → ${beginning.publishedName}`;
  }
  if (beginning !== undefined) {
    return `${beginning.publishedName} in`;
  }
  return `${ending?.publishedName ?? ''} out`;
};

/** Builds the calendar's news items from a window's records. */
export const buildCalendarNews = ({
  nights,
  mountings,
  closures,
}: {
  readonly nights: readonly TimelineNight[];
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
}): readonly CalendarNewsItem[] => {
  const windowStart = nights[0]?.interval.start ?? 0;
  const windowEnd = nights.at(-1)?.interval.end ?? 0;
  const inside = (instant: number): boolean => instant > windowStart && instant < windowEnd;
  const eveningOf = (instant: number): string | null => nightAt(nights, instant)?.eveningDate ?? null;

  const items: CalendarNewsItem[] = [];

  // One boundary per row and instant, so a swap (or a usability change, which
  // the importer records as two abutting mountings) is one chip, not an "out"
  // and an "in" saying the same thing twice.
  const boundaries = new Map<string, { ending?: Mounting; beginning?: Mounting }>();
  const boundaryAt = (rowLabel: string, instant: number) => {
    const key = `${rowLabel}@${String(instant)}`;
    const existing = boundaries.get(key) ?? {};
    boundaries.set(key, existing);
    return existing;
  };
  for (const mounting of mountings) {
    if (inside(mounting.interval.start)) {
      boundaryAt(mounting.rowLabel, mounting.interval.start).beginning = mounting;
    }
    if (inside(mounting.interval.end)) {
      boundaryAt(mounting.rowLabel, mounting.interval.end).ending = mounting;
    }
  }
  for (const [key, boundary] of boundaries) {
    const instant = Number(key.slice(key.lastIndexOf('@') + 1));
    const evening = eveningOf(instant);
    if (evening === null) {
      continue;
    }
    const incoming = boundary.beginning ?? null;
    items.push({
      eveningDate: evening,
      kind: 'INSTRUMENT',
      label: phrase(boundary),
      rowLabel: boundary.beginning?.rowLabel ?? boundary.ending?.rowLabel ?? null,
      instrument: incoming?.instrument ?? boundary.ending?.instrument ?? null,
      detail: incoming?.note ?? boundary.ending?.note ?? null,
    });
  }

  // The telescope's own news: it closes, and it reopens. The closed nights
  // themselves are the squares' wash (calendarNights); the chips mark the
  // instants. Port-scoped records are not the telescope closing.
  for (const closure of closures) {
    if (closure.port !== null || closure.availability !== 'CLOSED') {
      continue;
    }
    const begins = eveningOf(closure.interval.start);
    if (inside(closure.interval.start) && begins !== null) {
      items.push({
        eveningDate: begins,
        kind: 'CLOSED',
        label: closure.reason ?? 'Closed',
        rowLabel: null,
        instrument: null,
        detail: closure.reason,
      });
    }
    const reopens = eveningOf(closure.interval.end);
    if (inside(closure.interval.end) && reopens !== null) {
      items.push({
        eveningDate: reopens,
        kind: 'OPEN',
        label: 'Open',
        rowLabel: null,
        instrument: null,
        detail: null,
      });
    }
  }

  return items.sort((a, b) => a.eveningDate.localeCompare(b.eveningDate));
};
