import { portRowLabel } from './ports';
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
  /** The port the change is on - the row the chip belongs to. */
  readonly port: number;
  readonly instant: number;
  ending?: Mounting;
  beginning?: Mounting;
}

/** A swap names both instruments, a usability change the new usage, a one-sided boundary in or out. */
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

  // One boundary per row and instant, so a swap is one chip rather than an "out" and an "in".
  const boundaries = new Map<string, RowBoundary>();
  const boundaryAt = (port: number, instant: number): RowBoundary => {
    const key = `${String(port)}@${String(instant)}`;
    const existing = boundaries.get(key) ?? { port, instant };
    boundaries.set(key, existing);
    return existing;
  };
  // Ports only: an instrument moving between storage places is inventory, not a night's headline.
  for (const mounting of mountings) {
    if (mounting.port === null) {
      continue;
    }
    if (inside(mounting.interval.start)) {
      boundaryAt(mounting.port, mounting.interval.start).beginning = mounting;
    }
    if (inside(mounting.interval.end)) {
      boundaryAt(mounting.port, mounting.interval.end).ending = mounting;
    }
  }
  for (const boundary of boundaries.values()) {
    const evening = eveningOf(boundary.instant);
    if (evening === null) {
      continue;
    }
    const incoming = boundary.beginning ?? null;
    items.push({
      eveningDate: evening,
      kind: 'INSTRUMENT',
      label: phrase(boundary),
      rowLabel: portRowLabel(boundary.port),
      instrument: incoming?.instrument ?? boundary.ending?.instrument ?? null,
      detail: incoming?.note ?? boundary.ending?.note ?? null,
    });
  }

  // The closed nights are the squares' wash; these chips mark the instants.
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
