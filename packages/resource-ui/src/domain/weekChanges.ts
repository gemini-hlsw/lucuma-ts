import { portRowLabel } from './ports';
import type {
  ComponentLocation,
  ComponentUsage,
  InstrumentAvailabilityBlock,
  InstrumentComponent,
  InstrumentComponentAvailabilityBlock,
  Interval,
  TelescopeAvailabilityBlock,
} from './types';

/** A boundary exactly at the window's edge is not a change: a run from last week merely continues. */
export type WeekChange =
  | {
      readonly kind: 'RUN_BEGINS' | 'RUN_ENDS';
      readonly instant: number;
      /** The run's published name, e.g. "Maroon-X Run". */
      readonly label: string;
      readonly rowLabel: string;
      readonly note: string | null;
    }
  | {
      readonly kind: 'CLOSURE_BEGINS' | 'CLOSURE_ENDS';
      readonly instant: number;
      /** The printed reason, or a plain statement when the sheet gave none. */
      readonly label: string;
      /** Null when the whole telescope closes rather than one port. */
      readonly rowLabel: string | null;
    }
  | {
      readonly kind: 'COMPONENT';
      readonly instant: number;
      readonly component: InstrumentComponent;
      /** The state the piece enters at this instant. */
      readonly location: ComponentLocation;
      readonly usage: ComponentUsage;
      readonly note: string | null;
    };

export interface BuildWeekChangesOptions {
  readonly interval: Interval;
  readonly instrumentAvailability: readonly InstrumentAvailabilityBlock[];
  readonly telescopeAvailability: readonly TelescopeAvailabilityBlock[];
  readonly componentAvailability: readonly InstrumentComponentAvailabilityBlock[];
  readonly components: readonly InstrumentComponent[];
}

/** "Nothing recorded" is not a state a change can announce (I4), so only entered states are listed. */
export const buildWeekChanges = ({
  interval,
  instrumentAvailability,
  telescopeAvailability,
  componentAvailability,
  components,
}: BuildWeekChangesOptions): readonly WeekChange[] => {
  const inside = (instant: number): boolean => instant > interval.start && instant < interval.end;
  const changes: WeekChange[] = [];

  // Ports only: a stored instrument changing shelf is not a change to the week's observing.
  for (const instrumentBlock of instrumentAvailability) {
    if (instrumentBlock.port === null) {
      continue;
    }
    const rowLabel = portRowLabel(instrumentBlock.port);
    if (inside(instrumentBlock.interval.start)) {
      changes.push({
        kind: 'RUN_BEGINS',
        instant: instrumentBlock.interval.start,
        label: instrumentBlock.publishedName,
        rowLabel,
        note: instrumentBlock.note,
      });
    }
    if (inside(instrumentBlock.interval.end)) {
      changes.push({
        kind: 'RUN_ENDS',
        instant: instrumentBlock.interval.end,
        label: instrumentBlock.publishedName,
        rowLabel,
        note: null,
      });
    }
  }

  for (const telescopeBlock of telescopeAvailability) {
    // Only a closure beginning or ending is a change; the records carry explicit Open spans too.
    if (telescopeBlock.availability !== 'CLOSED') {
      continue;
    }
    const label = telescopeBlock.reason ?? (telescopeBlock.port === null ? 'Telescope closed' : 'Closed');
    const rowLabel = telescopeBlock.port === null ? null : portRowLabel(telescopeBlock.port);
    if (inside(telescopeBlock.interval.start)) {
      changes.push({ kind: 'CLOSURE_BEGINS', instant: telescopeBlock.interval.start, label, rowLabel });
    }
    if (inside(telescopeBlock.interval.end)) {
      changes.push({ kind: 'CLOSURE_ENDS', instant: telescopeBlock.interval.end, label, rowLabel });
    }
  }

  const byId = new Map(components.map((component) => [component.id, component]));
  for (const block of componentAvailability) {
    const component = byId.get(block.componentId);
    if (component !== undefined && inside(block.interval.start)) {
      changes.push({
        kind: 'COMPONENT',
        instant: block.interval.start,
        component,
        location: block.location,
        usage: block.usage,
        note: block.note,
      });
    }
  }

  return changes.sort((a, b) => a.instant - b.instant);
};
