/**
 * The component finder: what one row of the browser says about one piece, on
 * one night.
 *
 * ## Where "where" comes from
 *
 * A piece's block says INSTALLED or names a storage place. INSTALLED is
 * deliberately not a port: the piece is wherever its instrument is, so the
 * physical place is resolved here by joining the instrument's own mounting
 * records at the same night. The two sources cannot disagree, because one is
 * derived from the other.
 *
 * ## A night, not an instant
 *
 * The finder answers for an observing night - the URL's `night` selection, the
 * same one the night view reads - because that is the unit operations think in
 * and the unit the tests can pin without touching the wall clock. A night whose
 * records change partway through is reported as changing, with the state the
 * night *ends* in, since "where is it" usually means "where did it end up".
 */
import type {
  ComponentBlock,
  ComponentLocation,
  ComponentRecord,
  ComponentUsage,
  Instrument,
  Interval,
  Mounting,
} from './types';

export type ComponentWhere =
  | {
      readonly kind: 'INSTALLED';
      /** The port its instrument is on, or null where the site's rows are not ports. */
      readonly port: number | null;
      /** The instrument's published name, e.g. "GMOS" - what the label prints. */
      readonly instrumentName: string;
    }
  | { readonly kind: 'STORED'; readonly location: Exclude<ComponentLocation, 'INSTALLED'> }
  /** No record covers the night. Never rendered as "unavailable" (I4). */
  | { readonly kind: 'NOT_RECORDED' };

export interface FinderRow {
  readonly component: ComponentRecord;
  readonly where: ComponentWhere;
  /** Null exactly when nothing is recorded for the night. */
  readonly usage: ComponentUsage | null;
  readonly note: string | null;
  /** True when the piece's state changes during this night. */
  readonly changesTonight: boolean;
  /**
   * The instants (epoch ms) the piece's record changes during the night, in
   * order. A gap between two records contributes both of its edges - the record
   * ending and the next beginning are each a change worth naming.
   */
  readonly transitions: readonly number[];
}

const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

/**
 * The block that decides the night's answer: the latest one touching it, so a
 * piece that comes off mid-night reports where it ended up.
 */
const deciding = (blocks: readonly ComponentBlock[]): ComponentBlock | undefined => blocks.at(-1);

/**
 * Where consecutive blocks meet, or the edges of the gap between them. Both
 * blocks overlap the night and I3 keeps them disjoint, so every instant here
 * falls strictly inside the night without any clipping.
 */
const transitionsOf = (blocks: readonly ComponentBlock[]): readonly number[] =>
  blocks.slice(1).flatMap((block, index) => {
    const previous = blocks[index];
    return previous !== undefined && previous.interval.end < block.interval.start
      ? [previous.interval.end, block.interval.start]
      : [block.interval.start];
  });

/**
 * Where a block puts its piece, over a span.
 *
 * The span is the night for a browser row and the block's own extent for a
 * history line - the same derivation either way, which is what keeps "Installed"
 * from meaning one place in the row and another in the record under it. A block
 * long enough to outlast its instrument's mounting reports the first mounting it
 * overlaps; the schedule is the finer record, so the history line names where the
 * run began.
 */
export const whereOf = (
  instrument: Instrument,
  block: ComponentBlock,
  mountings: readonly Mounting[],
  span: Interval,
): ComponentWhere => {
  if (block.location !== 'INSTALLED') {
    return { kind: 'STORED', location: block.location };
  }
  const mounting = mountings.find(
    (candidate) => candidate.instrument === instrument && overlaps(candidate.interval, span),
  );
  return {
    kind: 'INSTALLED',
    port: mounting?.port ?? null,
    instrumentName: mounting?.publishedName ?? instrument,
  };
};

export interface BuildFinderRowsOptions {
  readonly components: readonly ComponentRecord[];
  readonly blocks: readonly ComponentBlock[];
  readonly mountings: readonly Mounting[];
  /** The observing night being asked about. */
  readonly night: Interval;
}

/** One row per catalog piece, in catalog order (instrument, then type, then name). */
export const buildFinderRows = ({
  components,
  blocks,
  mountings,
  night,
}: BuildFinderRowsOptions): readonly FinderRow[] =>
  components.map((component) => {
    const tonight = blocks
      .filter((block) => block.componentId === component.id && overlaps(block.interval, night))
      .sort((a, b) => a.interval.start - b.interval.start);
    const block = deciding(tonight);

    if (block === undefined) {
      return {
        component,
        where: { kind: 'NOT_RECORDED' },
        usage: null,
        note: null,
        changesTonight: false,
        transitions: [],
      };
    }
    const transitions = transitionsOf(tonight);
    return {
      component,
      where: whereOf(component.instrument, block, mountings, night),
      usage: block.usage,
      note: block.note,
      changesTonight: transitions.length > 0,
      transitions,
    };
  });

/** A piece's records over the window, newest last - what the row expansion lists. */
export const historyOf = (componentId: string, blocks: readonly ComponentBlock[]): readonly ComponentBlock[] =>
  blocks.filter((block) => block.componentId === componentId).sort((a, b) => a.interval.start - b.interval.start);

/** Case-insensitive match on any published identity, mirroring the API's `search`. */
export const matchesComponent = (component: ComponentRecord, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return [component.name, component.code, component.barcode ?? '', ...component.aliases].some((identity) =>
    identity.toLowerCase().includes(needle),
  );
};
