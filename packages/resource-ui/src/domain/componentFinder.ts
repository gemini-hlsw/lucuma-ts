import { overlaps, transitionsOf } from './interval';
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
  /** A gap contributes both edges: the record ending and the next beginning are each a change. */
  readonly transitions: readonly number[];
}

/** The latest block touching the night, so a piece that comes off mid-night reports where it ended up. */
const deciding = (blocks: readonly ComponentBlock[]): ComponentBlock | undefined => blocks.at(-1);

/** The same derivation for a row and a history line, so "Installed" cannot mean two places. */
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
