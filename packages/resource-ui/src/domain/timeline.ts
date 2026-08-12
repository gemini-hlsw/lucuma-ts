/**
 * Records over an interval -> the rows a timeline chart draws.
 *
 * The semester, the week and the night are the same picture over three window
 * sizes: rows of instrument runs, a band where the telescope was shut, and the
 * nights underneath for context. Only the window and the axis differ, so the
 * part that turns records into rows lives here once.
 *
 * ## Intervals stay intervals
 *
 * The published sheet is a grid of nights, and the first version of the semester
 * view reproduced it literally: one cell per night, then a second pass to work
 * out where the runs were so a label could be placed. GS 2026B is sixteen facts
 * drawn as nine hundred cells, and everything awkward about that view came from
 * the round trip - labels sized to a reconstructed span, columns pinned to a
 * fixed width, and partial nights impossible to draw at all, which is the one
 * thing the partial-night non-negotiable (CLAUDE.md) says must never become
 * impossible.
 *
 * Here a block stays a block: clipped to the window, drawn once, at whatever
 * boundaries it actually has. A block that changes mid-night is two blocks with
 * a boundary between them, and the night view shows exactly that.
 *
 * ## Closures at Gemini South are spelled across the rows
 *
 * The sheet writes "Telescope Shutdown A&G Maintenance" vertically down the port
 * rows during a shutdown, one word per row, and the importer faithfully records
 * each word as that port's closure reason. Rendered per row it reads as though
 * Port 2 were called "Telescope".
 *
 * The importer also emits the telescope-wide record, with the whole phrase. So
 * the wide closure becomes a band across every row, and each port closure has
 * the band's span subtracted. What survives is the part genuinely about that port
 * alone - A&G on Port 4, F2 on Port 5 in 2026A - and the fragments disappear,
 * because they had no span of their own to begin with.
 */
import type {
  Closure,
  Instrument,
  Interval,
  ModeBlock,
  Mounting,
  Partner,
  ResourceUsage,
  SubsystemBlock,
  TelescopeAvailability,
  TelescopeModeType,
  TelescopeSubsystem,
  TooBlock,
  TooSupport,
} from './types';

/**
 * What a block is, which decides how it is drawn.
 *
 * A block on a subject row either names an instrument (coloured by which, so a
 * reader picks GMOS out of a semester without reading every label) or it does
 * not, and an unnamed span is an absence drawn as one. Every view also heads
 * itself with telescope-state rows whose blocks are neither: whether the
 * telescope is open, its operating mode, and the ToO support level, each with
 * the value printed on the block (`variant` says which).
 *
 * A telescope-wide closure is not only in here: besides the Telescope row's
 * Closed block, it is a band across every row.
 */
export type BlockState =
  /** An instrument on this row over this span. Coloured by which instrument. */
  | 'MOUNTED'
  /**
   * The sheet marks the span but names no instrument. "A&G" on Gemini South's
   * Port 4 is the standing example, and what it means for availability is still
   * open with operations, so it is drawn as an absence rather
   * than assumed to be a six-month failure.
   */
  | 'UNSCHEDULED'
  /** Whether the telescope is open over this span, on the Telescope row. */
  | 'TELESCOPE'
  /** The ToO support level over this span, on the ToO row. */
  | 'TOO'
  /** The telescope's operating mode over this span, on the Mode row. */
  | 'MODE'
  /** A subsystem's operational state over this span, on the subsystem's row. */
  | 'SUBSYSTEM';

export interface TimelineBlock {
  readonly id: string;
  readonly rowLabel: string;
  readonly state: BlockState;
  /** Printed across the block. Empty when the sheet named nothing. */
  readonly label: string;
  readonly instrument: Instrument | null;
  /** What a MOUNTED instrument can be used for over this span; null otherwise. */
  readonly usage: ResourceUsage | null;
  /** The recorded value behind a TELESCOPE, TOO or MODE block; null otherwise. */
  readonly variant: TelescopeAvailability | TooSupport | TelescopeModeType | null;
  /** Clipped to the window being drawn. */
  readonly interval: Interval;
  /** The block's own span, for the tooltip - it may reach outside the window. */
  readonly fullInterval: Interval;
  /** Observing nights the whole block covers, for the tooltip. */
  readonly nights: number;
  /** True when the block reaches past this window's edge, so the bar is cut. */
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
  /** The note or closure reason, verbatim. Null when the sheet carried none. */
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

/** One observing night, for day labels, weekend shading and night boundaries. */
export interface TimelineNight {
  /** The night's own label, the date it ends on. */
  readonly observingNight: string;
  /** The date it begins on, which is what the published column is headed by. */
  readonly eveningDate: string;
  readonly interval: Interval;
  readonly isWeekend: boolean;
  /**
   * False when Resource holds nothing at all for this night.
   *
   * Never inferred from an empty row: a gap means "not recorded", and only the
   * API can say which it is (`telescopeNights.dataAvailable`). Defaults true so
   * a window that never asked is not drawn as a hole.
   */
  readonly dataAvailable: boolean;
}

/** What every timeline view carries besides its rows, for the legend. */
export interface TimelineLegend {
  /**
   * The instruments actually drawn, alphabetically.
   *
   * Only what appears: a legend carrying all thirteen would mostly be keys to
   * colours that are not on the page.
   */
  readonly instruments: readonly Instrument[];
  /** Whether any telescope-wide closure is drawn, so the legend can say so. */
  readonly hasClosure: boolean;
  /** Whether any row shows a span with no instrument named. */
  readonly hasUnscheduled: boolean;
  /** Whether any mounted span is restricted to engineering use. */
  readonly hasEngineeringUse: boolean;
  /** Whether any mounted span is recorded as not available. */
  readonly hasUnavailable: boolean;
}

/** The overlap of two intervals, or null when they miss. */
export const clip = (interval: Interval, bounds: Interval): Interval | null => {
  const start = Math.max(interval.start, bounds.start);
  const end = Math.min(interval.end, bounds.end);
  return start < end ? { start, end } : null;
};

/**
 * `interval` with every hole removed, left to right.
 *
 * This is what turns a port closure that merely coincides with a telescope-wide
 * shutdown into nothing, while keeping the part of one that outlasts it.
 */
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

/** Which row a closure belongs to: its port number, matched against "Port 3". */
const closureIsOnRow = (closure: Closure, rowLabel: string): boolean => {
  const port = /^port\s*(\d+)/i.exec(rowLabel)?.[1];
  return port !== undefined && closure.port === Number(port);
};

/**
 * Whole nights an interval spans, rounded.
 *
 * Rounded rather than floored because a night is 23 or 25 hours either side of a
 * DST change at Gemini South, and a run of thirty nights must still read as
 * thirty. A span shorter than a night reports zero, and the caller says "part of
 * a night" instead.
 */
export const nightsIn = (interval: Interval): number => Math.round((interval.end - interval.start) / 86_400_000);

/**
 * The night an instant falls in, or null outside the window.
 *
 * How a click on a chart resolves to a night: the axis is real time, so a click
 * lands on an instant, and nights abut exactly, so at most one contains it.
 */
export const nightAt = (nights: readonly TimelineNight[], instant: number): TimelineNight | null =>
  nights.find((night) => night.interval.start <= instant && instant < night.interval.end) ?? null;

/** A block before any window has been chosen: it still has its own full span. */
export type UnplacedBlock = Omit<TimelineBlock, 'interval' | 'continuesBefore' | 'continuesAfter'>;

/** Operational spellings of the ToO levels, printed on the ToO row's blocks. */
export const TOO_SUPPORT_LABEL = {
  STANDARD: 'Standard ToOs',
  INTERRUPT: 'Interrupt ToOs',
  RAPID: 'Rapid ToOs',
  NONE: 'No ToOs',
} satisfies Record<TooSupport, string>;

/** Operational spellings of the telescope modes, printed on the Mode row's blocks. */
export const TELESCOPE_MODE_LABEL = {
  QUEUE: 'Queue',
  CLASSICAL: 'Classical',
  PRIORITY_VISITOR: 'Priority visitor',
  ENGINEERING: 'Engineering',
  COMMISSIONING: 'Commissioning',
  SHUTDOWN: 'Shutdown',
  BLOCK_SCHEDULING: 'Block scheduling',
} satisfies Record<TelescopeModeType, string>;

/** A partner tag phrased for a block-scheduling span's detail. */
const PARTNER_LABEL = {
  AR: 'Argentina',
  BR: 'Brazil',
  CA: 'Canada',
  CL: 'Chile',
  KR: 'Republic of Korea',
  UH: 'University of Hawaii',
  US: 'United States',
} satisfies Record<Partner, string>;

/** The mode block's tooltip detail: programs, the block partner, the note. */
const modeDetail = (block: ModeBlock): string | null => {
  const parts = [
    ...(block.programReferences.length === 0 ? [] : [block.programReferences.join(', ')]),
    ...(block.partner === null ? [] : [PARTNER_LABEL[block.partner]]),
    ...(block.note === null ? [] : [block.note]),
  ];
  return parts.length === 0 ? null : parts.join(' - ');
};

/** How a mounted span's usage is phrased, wherever usage is stated. */
export const USAGE_LABEL = {
  SCIENCE: 'Science',
  ENGINEERING: 'Engineering use',
  UNAVAILABLE: 'Not available',
} satisfies Record<ResourceUsage, string>;

/** What the Telescope row's blocks print, per recorded availability. */
export const TELESCOPE_AVAILABILITY_LABEL = {
  OPEN: 'Open',
  CLOSED: 'Closed',
} satisfies Record<TelescopeAvailability, string>;

/** The telescope-state rows' labels, in the order they head every chart. */
export const TELESCOPE_ROW_LABEL = 'Telescope';
export const MODE_ROW_LABEL = 'Mode';
export const TOO_ROW_LABEL = 'ToO';

/** A subsystem row's gutter label. */
export const SUBSYSTEM_ROW_LABEL = {
  PWFS1: 'PWFS1',
  PWFS2: 'PWFS2',
  ALTAIR: 'Altair',
  CANOPUS: 'Canopus',
  LGS: 'LGS',
  GPOL: 'GPOL',
  DOME_SHUTTER: 'Dome shutter',
  DOME_VENT_GATES: 'Dome vents',
} satisfies Record<TelescopeSubsystem, string>;

/** The subsystem rows' order: the requirement's enum order, sensors first. */
const SUBSYSTEM_ORDER = Object.keys(SUBSYSTEM_ROW_LABEL) as readonly TelescopeSubsystem[];

/**
 * Which recorded states are worth noticing - the one semantic decision behind
 * the state rows' two monochrome fills (the fills themselves live in
 * `features/timeline/timelineOptions.ts`; the measurement is on the tokens in
 * global.css). The ordinary night is queue operation with standard ToO
 * support, so those read quiet; any other mode, and any departure from
 * standard ToOs - a night they cannot fire at all, or one that admits an
 * interrupt - should catch the eye. Exhaustive maps, so a new enum member must
 * choose rather than default.
 */
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

/**
 * Whether a TOO or MODE block records a notable state. False on every other
 * kind - a TELESCOPE block is never "notable" in the monochrome sense: Open is
 * the ordinary state and Closed takes the reserved closure red, not the bright
 * neutral.
 */
export const isNotableState = (block: Pick<TimelineBlock, 'state' | 'variant' | 'usage'>): boolean => {
  // Subsystems are never notable, deliberately - they say their state in words
  // instead. Mode and ToO departures are rare and event-like, so brightness
  // there is signal; subsystem availability is recorded every night and is
  // dominated by standing facts - Gemini South has no laser at all, so a bright
  // "Not available" would shout on every GS night forever and out-shout the
  // instrument runs the page is actually about. Revisit if real ICTD data shows
  // subsystem outages are rare enough to be news.
  if (block.state === 'SUBSYSTEM') {
    return false;
  }
  if (block.variant === null) {
    return false;
  }
  if (block.state === 'MODE' && isModeType(block.variant)) {
    return NOTABLE_MODE[block.variant];
  }
  if (block.state === 'TOO' && isTooSupport(block.variant)) {
    return NOTABLE_TOO[block.variant];
  }
  return false;
};

/**
 * The telescope-state rows, ahead of the subject rows: whether the telescope
 * is open, then its mode, then ToO support.
 *
 * These are facts about the telescope, independent of what any port carries,
 * so they head every chart rather than joining the port rows. A window with no
 * such records simply has no rows here - the gap stays a gap (I4) instead of
 * permanently empty rows. The Telescope row reads the whole-telescope
 * availability records (`port: null`), Open and Closed alike: the workbook
 * records both explicitly.
 */
export const collectStateRows = (
  closures: readonly Closure[],
  tooBlocks: readonly TooBlock[],
  modeBlocks: readonly ModeBlock[],
  subsystemBlocks: readonly SubsystemBlock[] = [],
): readonly { readonly label: string; readonly blocks: readonly UnplacedBlock[] }[] => {
  const telescope = closures.filter((closure) => closure.port === null);
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
    ...(modeBlocks.length === 0
      ? []
      : [
          {
            label: MODE_ROW_LABEL,
            blocks: modeBlocks.map((block) => ({
              id: block.id,
              rowLabel: MODE_ROW_LABEL,
              state: 'MODE' as const,
              label: TELESCOPE_MODE_LABEL[block.mode],
              instrument: null,
              usage: null,
              variant: block.mode,
              fullInterval: block.interval,
              nights: nightsIn(block.interval),
              // The programs (or the block partner) are the interesting fact
              // about a non-queue span; the note rides along when recorded.
              detail: modeDetail(block),
            })),
          },
        ]),
    ...(tooBlocks.length === 0
      ? []
      : [
          {
            label: TOO_ROW_LABEL,
            blocks: tooBlocks.map((block) => ({
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
    // One row per subsystem with records, in the requirement's order. The bar
    // prints the usage in the same words a mounted span uses; hue stays the
    // instruments' alone, so these draw in the state neutrals.
    ...SUBSYSTEM_ORDER.flatMap((subsystem) => {
      const records = subsystemBlocks.filter((block) => block.subsystem === subsystem);
      return records.length === 0
        ? []
        : [
            {
              label: SUBSYSTEM_ROW_LABEL[subsystem],
              blocks: records.map((block) => ({
                id: block.id,
                rowLabel: SUBSYSTEM_ROW_LABEL[subsystem],
                state: 'SUBSYSTEM' as const,
                label: USAGE_LABEL[block.usage],
                instrument: null,
                usage: block.usage,
                variant: null,
                fullInterval: block.interval,
                nights: nightsIn(block.interval),
                detail: subsystemDetail(block),
              })),
            },
          ];
    }),
  ];
};

/** The subsystem block's tooltip detail: the power source, then the note. */
const subsystemDetail = (block: SubsystemBlock): string | null => {
  const parts = [
    ...(block.powerSource === null ? [] : [block.powerSource === 'GENERATOR' ? 'Generator power' : 'Commercial power']),
    ...(block.note === null ? [] : [block.note]),
  ];
  return parts.length === 0 ? null : parts.join(' - ');
};

/**
 * Whether a row is one of the telescope-state rows. By label: the labels are
 * this module's own constants, so a subject row cannot collide with them
 * without colliding on screen too. (An off-port instrument row could share a
 * subsystem's name - "Canopus" - which is why the count below reads only the
 * *leading* rows: state rows always precede the subjects.)
 */
const STATE_ROW_LABELS = new Set<string>([
  TELESCOPE_ROW_LABEL,
  MODE_ROW_LABEL,
  TOO_ROW_LABEL,
  ...Object.values(SUBSYSTEM_ROW_LABEL),
]);

/** How many leading rows are telescope-state rows - a chart's header band. */
export const stateRowCount = (rows: readonly { readonly label: string }[]): number => {
  let count = 0;
  while (count < rows.length && STATE_ROW_LABELS.has(rows[count]?.label ?? '')) {
    count += 1;
  }
  return count;
};

export interface TimelineSource {
  readonly rowLabels: readonly string[];
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
}

/**
 * Every block on every row, with the telescope-wide spans already subtracted
 * from the port closures. Window-independent, so a semester can place the same
 * blocks in six months without rebuilding them.
 */
export const collectBlocks = ({
  rowLabels,
  mountings,
  closures,
}: TimelineSource): readonly { readonly label: string; readonly blocks: readonly UnplacedBlock[] }[] => {
  // CLOSED only: the availability records also carry the explicit Open spans,
  // which the Telescope state row draws and nothing here may treat as shut.
  const wideSpans = closures
    .filter((closure) => closure.port === null && closure.availability === 'CLOSED')
    .map((closure) => closure.interval);

  return rowLabels.map((rowLabel) => {
    const onRow = mountings.filter((mounting) => mounting.rowLabel === rowLabel);
    // Gemini North's sheet has two physical "Visiting" rows sharing one label,
    // so an unidentified (UNKNOWN) band can genuinely coincide with a named
    // run. This chart has one row per label, so the identified run wins the
    // shared span and the unknown keeps what is genuinely its own - the same
    // rule the wide closure spans apply to port closures below.
    const identifiedSpans = onRow
      .filter((mounting) => mounting.instrument !== 'UNKNOWN')
      .map((mounting) => mounting.interval);

    const mountingBlock = (mounting: Mounting, piece: Interval, id: string): UnplacedBlock => ({
      id,
      rowLabel,
      state: 'MOUNTED' as const,
      label: mounting.publishedName,
      instrument: mounting.instrument,
      usage: mounting.usage,
      variant: null,
      fullInterval: piece,
      nights: nightsIn(piece),
      detail: mounting.note,
    });

    return {
      label: rowLabel,
      blocks: [
        ...onRow.flatMap((mounting) =>
          mounting.instrument === 'UNKNOWN'
            ? subtract(mounting.interval, identifiedSpans).map((piece, index) =>
                mountingBlock(mounting, piece, `${mounting.id}-${index}`),
              )
            : [mountingBlock(mounting, mounting.interval, mounting.id)],
        ),
        ...closures
          .filter((closure) => closure.availability === 'CLOSED' && closureIsOnRow(closure, rowLabel))
          .flatMap((closure) =>
            subtract(closure.interval, wideSpans).map((piece, index) => ({
              id: `${closure.id}-${index}`,
              rowLabel,
              state: 'UNSCHEDULED' as const,
              label: closure.reason ?? '',
              instrument: null,
              usage: null,
              variant: null,
              fullInterval: piece,
              nights: nightsIn(piece),
              detail: closure.reason,
            })),
          ),
      ],
    };
  });
};

/** Places collected blocks in one window, dropping those that miss it. */
export const placeBlocks = (collected: ReturnType<typeof collectBlocks>, bounds: Interval): readonly TimelineRow[] =>
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

/** Telescope-wide closures clipped to one window. */
export const placeBands = (closures: readonly Closure[], bounds: Interval): readonly TimelineBand[] =>
  closures
    .filter((closure) => closure.port === null && closure.availability === 'CLOSED')
    .flatMap((closure) => {
      const visible = clip(closure.interval, bounds);
      return visible === null ? [] : [{ id: closure.id, interval: visible, label: closure.reason ?? 'Closed' }];
    });

/** What the legend should key, derived from what was actually placed. */
export const legendFor = (rows: readonly TimelineRow[], bands: readonly TimelineBand[]): TimelineLegend => {
  const instruments = new Set<Instrument>();
  let hasUnscheduled = false;
  let hasEngineeringUse = false;
  let hasUnavailable = false;
  for (const row of rows) {
    for (const block of row.blocks) {
      // By state, not by a null instrument: the ToO and mode blocks name no
      // instrument either, but they are recorded state, not the absence the
      // unscheduled key describes.
      if (block.state === 'UNSCHEDULED') {
        hasUnscheduled = true;
      } else if (block.instrument !== null) {
        instruments.add(block.instrument);
        hasEngineeringUse ||= block.usage === 'ENGINEERING';
        hasUnavailable ||= block.usage === 'UNAVAILABLE';
      }
    }
  }
  return {
    // Alphabetical, so the key's order is stable across windows rather than
    // following whichever row happens to come first.
    instruments: [...instruments].sort(),
    hasClosure: bands.length > 0,
    hasUnscheduled,
    hasEngineeringUse,
    hasUnavailable,
  };
};
