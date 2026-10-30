import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';

import { clip } from './interval';
import { portRowLabel, portRows } from './ports';
import { addDays, isWeekendDate } from './semester';
import { observingNightInterval } from './siteTime';
import type {
  InstrumentAvailabilityBlock,
  Interval,
  Partner,
  ResourceInstrument,
  ResourceUsage,
  Schedule,
  Site,
  TelescopeAvailability,
  TelescopeAvailabilityBlock,
  TelescopeModeBlock,
  TelescopeModeType,
  TooSupport,
} from './types';

export type BlockState =
  | 'MOUNTED'
  /** The sheet marks the span but names no instrument. Drawn as an absence, never assumed to be a failure. */
  | 'UNSCHEDULED'
  | 'TELESCOPE'
  | 'TOO'
  | 'MODE';

export interface TimelineBlock {
  readonly id: string;
  readonly rowLabel: string;
  readonly state: BlockState;
  /** Printed across the block. Empty when the sheet named nothing. */
  readonly label: string;
  readonly instrument: ResourceInstrument | null;
  /** What a MOUNTED instrument can be used for over this span; null otherwise. */
  readonly usage: ResourceUsage | null;
  /** The recorded value behind a TELESCOPE, TOO or MODE block; null otherwise. */
  readonly variant: TelescopeAvailability | TooSupport | TelescopeModeType | null;
  /** Clipped to the window being drawn. */
  readonly interval: Interval;
  /** The block's own span, which may reach outside the window. */
  readonly fullInterval: Interval;
  /** Nights the whole block covers, not the clipped part. */
  readonly nights: number;
  /** True when the block reaches past this window's edge, so the bar is cut. */
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
  /** The note or closure reason, verbatim. */
  readonly detail: string | null;
}

export interface TimelineRow {
  readonly key: string;
  readonly label: string;
  readonly blocks: readonly TimelineBlock[];
}

/** A telescope-wide closure: one span across every row, labelled once. */
export interface TimelineBand {
  readonly id: string;
  readonly interval: Interval;
  readonly label: string;
}

export interface TimelineNight {
  /** The night's own label, the date it ends on. */
  readonly observingNight: string;
  /** The date it begins on, which is what the published column is headed by. */
  readonly eveningDate: string;
  readonly interval: Interval;
  readonly isWeekend: boolean;
  /** From the API only, never inferred from an empty row. Defaults true so an unasked window is not a hole. */
  readonly dataAvailable: boolean;
}

/** Keys only, never labels or swatches: what each key looks like is the legend bar's one table. */
export interface TimelineLegend {
  /** Only those actually drawn: keys to colours that are not on the page are noise. */
  readonly instruments: readonly ResourceInstrument[];
  readonly modes: readonly TelescopeModeType[];
  readonly toos: readonly TooSupport[];
  readonly hasOpen: boolean;
  readonly hasClosure: boolean;
  readonly hasUnscheduled: boolean;
  readonly hasEngineeringUse: boolean;
  readonly hasUnavailable: boolean;
  /** A window of one night draws no weekend shading, so it has no weekend key. */
  readonly hasWeekend: boolean;
  readonly hasNoData: boolean;
}

export interface WindowInput {
  readonly nights: readonly TimelineNight[];
  readonly schedule: Schedule;
}

/** `interval` with every hole removed, so a port closure inside a wide shutdown becomes nothing. */
export const subtract = (interval: Interval, holes: readonly Interval[]): readonly Interval[] => {
  let pieces: Interval[] = [interval];
  for (const hole of holes) {
    pieces = pieces.flatMap((piece) => {
      const overlap = clip(piece, hole);
      if (overlap === null) {
        return [piece];
      }
      const remaining: Interval[] = [];
      if (piece.start < overlap.start) {
        remaining.push({ start: piece.start, end: overlap.start });
      }
      if (overlap.end < piece.end) {
        remaining.push({ start: overlap.end, end: piece.end });
      }
      return remaining;
    });
  }
  return pieces;
};

/** Rounded, not floored: a night is 23 or 25 hours across a GS DST change, and thirty must read as thirty. */
export const nightsIn = (interval: Interval): number => Math.round((interval.end - interval.start) / 86_400_000);

/** A window's nights in order; `hasData` is the API's per-night flag where the window asks for one. */
export const timelineNights = (
  site: Site,
  observingNights: readonly string[],
  hasData: (observingNight: string) => boolean = () => true,
): readonly TimelineNight[] =>
  observingNights.map((observingNight) => {
    const eveningDate = addDays(observingNight, -1);
    return {
      observingNight,
      eveningDate,
      interval: observingNightInterval(site, observingNight),
      isWeekend: isWeekendDate(eveningDate),
      dataAvailable: hasData(observingNight),
    };
  });

/** First night's start to last night's end; they abut, so it is continuous. */
const spanOfNights = (nights: readonly TimelineNight[]): Interval => ({
  start: nights[0]?.interval.start ?? 0,
  end: nights.at(-1)?.interval.end ?? 0,
});

export const nightAt = (nights: readonly TimelineNight[], instant: number): TimelineNight | null =>
  nights.find((night) => night.interval.start <= instant && instant < night.interval.end) ?? null;

/** A block before any window has been chosen: it still has its own full span. */
export type UnplacedBlock = Omit<TimelineBlock, 'interval' | 'continuesBefore' | 'continuesAfter'>;

export interface UnplacedRow {
  readonly label: string;
  readonly blocks: readonly UnplacedBlock[];
}

const isTelescopeWide = (block: TelescopeAvailabilityBlock): boolean => block.port === null;
const isClosed = (block: TelescopeAvailabilityBlock): boolean => block.availability === 'CLOSED';
const wideClosures = (blocks: readonly TelescopeAvailabilityBlock[]): readonly TelescopeAvailabilityBlock[] =>
  blocks.filter(isTelescopeWide).filter(isClosed);

/** Read under a row or legend section already named ToO, so the word is not repeated. */
export const TOO_SUPPORT_LABEL = {
  STANDARD: 'Standard',
  INTERRUPT: 'Interrupt',
  RAPID: 'Rapid',
  NONE: 'None',
} satisfies Record<TooSupport, string>;

export const TELESCOPE_MODE_LABEL = {
  QUEUE: 'Queue',
  CLASSICAL: 'Classical',
  PRIORITY_VISITOR: 'Priority visitor',
  ENGINEERING: 'Engineering',
  COMMISSIONING: 'Commissioning',
  SHUTDOWN: 'Shutdown',
  BLOCK_SCHEDULING: 'Block scheduling',
} satisfies Record<TelescopeModeType, string>;

const PARTNER_LABEL = {
  AR: 'Argentina',
  BR: 'Brazil',
  CA: 'Canada',
  CL: 'Chile',
  KR: 'Republic of Korea',
  UH: 'University of Hawaii',
  US: 'United States',
} satisfies Record<Partner, string>;

const modeDetail = (block: TelescopeModeBlock): string | null => {
  const parts = [
    ...(block.programReferences.length === 0 ? [] : [block.programReferences.join(', ')]),
    ...(block.partner === null ? [] : [PARTNER_LABEL[block.partner]]),
    ...(block.note === null ? [] : [block.note]),
  ];
  return parts.length === 0 ? null : parts.join(' - ');
};

export const USAGE_LABEL = {
  SCIENCE: 'Science',
  ENGINEERING: 'Engineering use',
  UNAVAILABLE: 'Not available',
} satisfies Record<ResourceUsage, string>;

export const TELESCOPE_AVAILABILITY_LABEL = {
  OPEN: 'Open',
  CLOSED: 'Closed',
} satisfies Record<TelescopeAvailability, string>;

// In the order they head every chart.
export const TELESCOPE_ROW_LABEL = 'Telescope';
export const MODE_ROW_LABEL = 'Mode';
export const TOO_ROW_LABEL = 'ToO';

/** The ordinary night is queue operation with standard ToO support; anything else is worth noticing. */
export const NOTABLE_MODE = {
  QUEUE: false,
  CLASSICAL: true,
  PRIORITY_VISITOR: true,
  ENGINEERING: true,
  COMMISSIONING: true,
  SHUTDOWN: true,
  BLOCK_SCHEDULING: true,
} satisfies Record<TelescopeModeType, boolean>;

export const NOTABLE_TOO = {
  STANDARD: false,
  INTERRUPT: true,
  RAPID: true,
  NONE: true,
} satisfies Record<TooSupport, boolean>;

const isTooSupport = (variant: string): variant is TooSupport => variant in NOTABLE_TOO;
const isModeType = (variant: string): variant is TelescopeModeType => variant in NOTABLE_MODE;

/** The mode a MODE block carries, or null for any other block or an unknown mode. */
const modeOf = (block: Pick<TimelineBlock, 'state' | 'variant'>): TelescopeModeType | null =>
  block.state === 'MODE' && isNotNullish(block.variant) && isModeType(block.variant) ? block.variant : null;

/** The ToO level a TOO block carries, or null for any other block or an unknown level. */
const tooOf = (block: Pick<TimelineBlock, 'state' | 'variant'>): TooSupport | null =>
  block.state === 'TOO' && isNotNullish(block.variant) && isTooSupport(block.variant) ? block.variant : null;

/** A TELESCOPE block is never notable: Closed takes the reserved closure red, not the bright neutral. */
export const isNotableState = (block: Pick<TimelineBlock, 'state' | 'variant' | 'usage'>): boolean => {
  const mode = modeOf(block);
  if (mode !== null) {
    return NOTABLE_MODE[mode];
  }
  const too = tooOf(block);
  if (too !== null) {
    return NOTABLE_TOO[too];
  }
  return false;
};

/** A window with no state records gets no state rows: the gap stays a gap (I4). */
const collectStateRows = ({ telescopeAvailability, tooSupport, telescopeMode }: Schedule): readonly UnplacedRow[] => {
  // Open and Closed alike, unlike the CLOSED-only band below: the Telescope row states both.
  const telescope = telescopeAvailability.filter(isTelescopeWide);
  return [
    ...(telescope.length === 0
      ? []
      : [
          {
            label: TELESCOPE_ROW_LABEL,
            blocks: telescope.map((record) => ({
              id: `telescope-${record.id}`,
              rowLabel: TELESCOPE_ROW_LABEL,
              state: 'TELESCOPE' as const,
              label: TELESCOPE_AVAILABILITY_LABEL[record.availability],
              instrument: null,
              usage: null,
              variant: record.availability,
              fullInterval: record.interval,
              nights: nightsIn(record.interval),
              detail: record.reason,
            })),
          },
        ]),
    ...(telescopeMode.length === 0
      ? []
      : [
          {
            label: MODE_ROW_LABEL,
            blocks: telescopeMode.map((block) => ({
              id: block.id,
              rowLabel: MODE_ROW_LABEL,
              state: 'MODE' as const,
              label: TELESCOPE_MODE_LABEL[block.mode],
              instrument: null,
              usage: null,
              variant: block.mode,
              fullInterval: block.interval,
              nights: nightsIn(block.interval),
              detail: modeDetail(block),
            })),
          },
        ]),
    ...(tooSupport.length === 0
      ? []
      : [
          {
            label: TOO_ROW_LABEL,
            blocks: tooSupport.map((block) => ({
              id: block.id,
              rowLabel: TOO_ROW_LABEL,
              state: 'TOO' as const,
              label: TOO_SUPPORT_LABEL[block.tooSupport],
              instrument: null,
              usage: null,
              variant: block.tooSupport,
              fullInterval: block.interval,
              nights: nightsIn(block.interval),
              detail: block.note,
            })),
          },
        ]),
  ];
};

/** By label, since the labels are this module's own constants. */
const STATE_ROW_LABELS = new Set<string>([TELESCOPE_ROW_LABEL, MODE_ROW_LABEL, TOO_ROW_LABEL]);

/** Leading rows only: state rows always precede the subjects. */
export const stateRowCount = (rows: readonly { readonly label: string }[]): number => {
  let count = 0;
  while (count < rows.length && STATE_ROW_LABELS.has(rows[count]?.label ?? '')) {
    count += 1;
  }
  return count;
};

const collectBlocks = ({ instrumentAvailability, telescopeAvailability }: Schedule): readonly UnplacedRow[] => {
  // CLOSED only: the Open spans are the Telescope row's, and nothing here may treat them as shut.
  const wideSpans = wideClosures(telescopeAvailability).map((telescopeBlock) => telescopeBlock.interval);

  return portRows([...instrumentAvailability, ...telescopeAvailability].map((record) => record.port)).map((port) => {
    const rowLabel = portRowLabel(port);
    const onRow = instrumentAvailability.filter((instrumentBlock) => instrumentBlock.port === port);
    // One row per port, so an identified run wins a span an UNKNOWN band also covers.
    const identifiedSpans = onRow
      .filter((instrumentBlock) => instrumentBlock.instrument !== 'UNKNOWN')
      .map((instrumentBlock) => instrumentBlock.interval);

    const instrumentRowBlock = (
      instrumentBlock: InstrumentAvailabilityBlock,
      piece: Interval,
      id: string,
    ): UnplacedBlock => ({
      id,
      rowLabel,
      state: 'MOUNTED' as const,
      label: instrumentBlock.publishedName,
      instrument: instrumentBlock.instrument,
      usage: instrumentBlock.usage,
      variant: null,
      fullInterval: piece,
      nights: nightsIn(piece),
      detail: instrumentBlock.note,
    });

    return {
      label: rowLabel,
      blocks: [
        ...onRow.flatMap((instrumentBlock) =>
          instrumentBlock.instrument === 'UNKNOWN'
            ? subtract(instrumentBlock.interval, identifiedSpans).map((piece, index) =>
                instrumentRowBlock(instrumentBlock, piece, `${instrumentBlock.id}-${index}`),
              )
            : [instrumentRowBlock(instrumentBlock, instrumentBlock.interval, instrumentBlock.id)],
        ),
        ...telescopeAvailability
          .filter(isClosed)
          .filter((telescopeBlock) => telescopeBlock.port === port)
          .flatMap((telescopeBlock) =>
            subtract(telescopeBlock.interval, wideSpans).map((piece, index) => ({
              id: `${telescopeBlock.id}-${index}`,
              rowLabel,
              state: 'UNSCHEDULED' as const,
              label: telescopeBlock.reason ?? '',
              instrument: null,
              usage: null,
              variant: null,
              fullInterval: piece,
              nights: nightsIn(piece),
              detail: telescopeBlock.reason,
            })),
          ),
      ],
    };
  });
};

/** Places collected blocks in one window, dropping those that miss it. */
const placeBlocks = (collected: readonly UnplacedRow[], bounds: Interval): readonly TimelineRow[] =>
  collected.map(({ label, blocks }) => ({
    key: label,
    label,
    blocks: blocks.flatMap((block) => {
      const visible = clip(block.fullInterval, bounds);
      return visible === null
        ? []
        : [
            {
              ...block,
              interval: visible,
              continuesBefore: block.fullInterval.start < bounds.start,
              continuesAfter: block.fullInterval.end > bounds.end,
            },
          ];
    }),
  }));

/** Telescope-wide closures, each still its whole span. */
const collectBands = ({ telescopeAvailability }: Schedule): readonly TimelineBand[] =>
  wideClosures(telescopeAvailability).map((telescopeBlock) => ({
    id: telescopeBlock.id,
    interval: telescopeBlock.interval,
    label: telescopeBlock.reason ?? 'Closed',
  }));

const placeBands = (bands: readonly TimelineBand[], bounds: Interval): readonly TimelineBand[] =>
  bands.flatMap((band) => {
    const visible = clip(band.interval, bounds);
    return visible === null ? [] : [{ ...band, interval: visible }];
  });

/** Derived from what was actually placed, never from the schema. */
const legendFor = (
  rows: readonly TimelineRow[],
  bands: readonly TimelineBand[],
  nights: readonly TimelineNight[],
): TimelineLegend => {
  const instruments = new Set<ResourceInstrument>();
  const modes = new Set<TelescopeModeType>();
  const toos = new Set<TooSupport>();
  let hasOpen = false;
  let hasUnscheduled = false;
  let hasEngineeringUse = false;
  let hasUnavailable = false;
  for (const row of rows) {
    for (const block of row.blocks) {
      const mode = modeOf(block);
      const too = tooOf(block);
      // By state, not by a null instrument: ToO and mode blocks name none either.
      if (block.state === 'UNSCHEDULED') {
        hasUnscheduled = true;
      } else if (block.state === 'TELESCOPE') {
        hasOpen ||= block.variant === 'OPEN';
      } else if (mode !== null) {
        modes.add(mode);
      } else if (too !== null) {
        toos.add(too);
      } else if (isNotNullish(block.instrument)) {
        instruments.add(block.instrument);
        hasEngineeringUse ||= block.usage === 'ENGINEERING';
        hasUnavailable ||= block.usage === 'UNAVAILABLE';
      }
    }
  }
  return {
    // Alphabetical, so the key's order is stable across windows.
    instruments: [...instruments].sort(),
    modes: [...modes],
    toos: [...toos],
    hasOpen,
    hasClosure: bands.length > 0,
    hasUnscheduled,
    hasEngineeringUse,
    hasUnavailable,
    hasWeekend: nights.length > 1 && nights.some((night) => night.isWeekend),
    hasNoData: nights.some((night) => !night.dataAvailable),
  };
};

export interface WindowProjection {
  readonly interval: Interval;
  readonly rows: readonly TimelineRow[];
  readonly bands: readonly TimelineBand[];
  readonly legend: TimelineLegend;
}

/** A schedule read before any window is chosen: its rows and bands, every block still its whole span. */
export interface CollectedSchedule {
  readonly rows: readonly UnplacedRow[];
  readonly bands: readonly TimelineBand[];
}

export const collectSchedule = (schedule: Schedule): CollectedSchedule => ({
  rows: [...collectStateRows(schedule), ...collectBlocks(schedule)],
  bands: collectBands(schedule),
});

/** One window over a collected schedule: what lands in it, clipped, and the legend of what landed. */
export const placeWindow = (collected: CollectedSchedule, nights: readonly TimelineNight[]): WindowProjection => {
  const interval = spanOfNights(nights);
  const rows = placeBlocks(collected.rows, interval);
  const bands = placeBands(collected.bands, interval);
  return { interval, rows, bands, legend: legendFor(rows, bands, nights) };
};

/** The one path from a schedule to placed rows: every window projects through here and adds only its own extras. */
export const projectWindow = ({ nights, schedule }: WindowInput): WindowProjection =>
  placeWindow(collectSchedule(schedule), nights);
