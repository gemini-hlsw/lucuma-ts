import { portRowLabel, portRows } from './ports';
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

export type BlockState =
  | 'MOUNTED'
  /** The sheet marks the span but names no instrument. Drawn as an absence, never assumed to be a failure. */
  | 'UNSCHEDULED'
  | 'TELESCOPE'
  | 'TOO'
  | 'MODE'
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

export interface TimelineLegend {
  /** Only those actually drawn: keys to colours that are not on the page are noise. */
  readonly instruments: readonly Instrument[];
  readonly hasClosure: boolean;
  readonly hasUnscheduled: boolean;
  readonly hasEngineeringUse: boolean;
  readonly hasUnavailable: boolean;
}

/** The overlap of two intervals, or null when they miss. */
export const clip = (interval: Interval, bounds: Interval): Interval | null => {
  const start = Math.max(interval.start, bounds.start);
  const end = Math.min(interval.end, bounds.end);
  return start < end ? { start, end } : null;
};

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

export const nightAt = (nights: readonly TimelineNight[], instant: number): TimelineNight | null =>
  nights.find((night) => night.interval.start <= instant && instant < night.interval.end) ?? null;

/** A block before any window has been chosen: it still has its own full span. */
export type UnplacedBlock = Omit<TimelineBlock, 'interval' | 'continuesBefore' | 'continuesAfter'>;

export const TOO_SUPPORT_LABEL = {
  STANDARD: 'Standard ToOs',
  INTERRUPT: 'Interrupt ToOs',
  RAPID: 'Rapid ToOs',
  NONE: 'No ToOs',
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

const modeDetail = (block: ModeBlock): string | null => {
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

/** Not the instruments' words: a subsystem is available for science, it is not doing science. */
export const SUBSYSTEM_USAGE_LABEL = {
  SCIENCE: 'Available',
  ENGINEERING: 'Engineering use',
  UNAVAILABLE: 'Not available',
} satisfies Record<ResourceUsage, string>;

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

/** The requirement's enum order, sensors first. */
const SUBSYSTEM_ORDER = Object.keys(SUBSYSTEM_ROW_LABEL) as readonly TelescopeSubsystem[];

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

/** A TELESCOPE block is never notable: Closed takes the reserved closure red, not the bright neutral. */
export const isNotableState = (block: Pick<TimelineBlock, 'state' | 'variant' | 'usage'>): boolean => {
  // Subsystem state is recorded nightly and dominated by standing facts, so brightness there is noise.
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

/** A window with no state records gets no state rows: the gap stays a gap (I4). */
export const collectStateRows = (
  closures: readonly Closure[],
  tooBlocks: readonly TooBlock[],
  modeBlocks: readonly ModeBlock[],
  subsystemBlocks: readonly SubsystemBlock[] = [],
): readonly { readonly label: string; readonly blocks: readonly UnplacedBlock[] }[] => {
  // Open and Closed alike, unlike the CLOSED-only band below: the Telescope row states both.
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
    // Hue stays the instruments' alone, so these draw in the state neutrals.
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
                label: SUBSYSTEM_USAGE_LABEL[block.usage],
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

const subsystemDetail = (block: SubsystemBlock): string | null => {
  const parts = [
    ...(block.powerSource === null ? [] : [block.powerSource === 'GENERATOR' ? 'Generator power' : 'Commercial power']),
    ...(block.note === null ? [] : [block.note]),
  ];
  return parts.length === 0 ? null : parts.join(' - ');
};

/** By label, since the labels are this module's own constants. */
const STATE_ROW_LABELS = new Set<string>([
  TELESCOPE_ROW_LABEL,
  MODE_ROW_LABEL,
  TOO_ROW_LABEL,
  ...Object.values(SUBSYSTEM_ROW_LABEL),
]);

/** Leading rows only: state rows always precede the subjects. */
export const stateRowCount = (rows: readonly { readonly label: string }[]): number => {
  let count = 0;
  while (count < rows.length && STATE_ROW_LABELS.has(rows[count]?.label ?? '')) {
    count += 1;
  }
  return count;
};

export interface TimelineSource {
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
}

/** Window-independent, so a semester places the same blocks in six months without rebuilding them. */
export const collectBlocks = ({
  mountings,
  closures,
}: TimelineSource): readonly { readonly label: string; readonly blocks: readonly UnplacedBlock[] }[] => {
  // CLOSED only: the Open spans are the Telescope row's, and nothing here may treat them as shut.
  const wideSpans = closures
    .filter((closure) => closure.port === null && closure.availability === 'CLOSED')
    .map((closure) => closure.interval);

  return portRows([...mountings, ...closures].map((record) => record.port)).map((port) => {
    const rowLabel = portRowLabel(port);
    const onRow = mountings.filter((mounting) => mounting.port === port);
    // One row per port, so an identified run wins a span an UNKNOWN band also covers.
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
          .filter((closure) => closure.availability === 'CLOSED' && closure.port === port)
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

/** Derived from what was actually placed, never from the schema. */
export const legendFor = (rows: readonly TimelineRow[], bands: readonly TimelineBand[]): TimelineLegend => {
  const instruments = new Set<Instrument>();
  let hasUnscheduled = false;
  let hasEngineeringUse = false;
  let hasUnavailable = false;
  for (const row of rows) {
    for (const block of row.blocks) {
      // By state, not by a null instrument: ToO and mode blocks name none either.
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
    // Alphabetical, so the key's order is stable across windows.
    instruments: [...instruments].sort(),
    hasClosure: bands.length > 0,
    hasUnscheduled,
    hasEngineeringUse,
    hasUnavailable,
  };
};
