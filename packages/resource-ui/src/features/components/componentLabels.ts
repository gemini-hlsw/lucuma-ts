/**
 * The words every component table shares. Split from the cells because the
 * react-refresh rule wants component files exporting only components.
 */
import type { RecordStatus } from '@/components/ui/StatusTag';
import type { WhereReading } from '@/components/ui/WhereCell';
import type { ComponentWhere, FinderRow } from '@/domain/componentFinder';
import { portRowLabel } from '@/domain/ports';
import type { ComponentType, ResourceUsage } from '@/domain/types';

export const TYPE_LABEL: Record<ComponentType, string> = {
  FILTER: 'Filter',
  DISPERSER: 'Disperser',
  FPU: 'FPU',
  WFS: 'WFS',
  OTHER: 'Other',
};

export const LOCATION_LABEL = {
  FLOOR: 'Dome floor',
  LAB: 'Summit lab',
  BASE: 'Base facility',
  UNKNOWN: 'Unknown',
} as const;

/** "Port 3 · GMOS", or the instrument alone when its own record names no port. */
export const whereLabel = (where: ComponentWhere): string => {
  switch (where.kind) {
    case 'INSTALLED':
      return where.port === null
        ? `On telescope · ${where.instrumentName}`
        : `${portRowLabel(where.port)} · ${where.instrumentName}`;
    case 'STORED':
      return LOCATION_LABEL[where.location];
    default:
      return 'Not recorded';
  }
};

/**
 * One row's Where cell, for the shared `WhereCell`.
 *
 * `changesTag` is the caller's because the words differ with the window: a
 * browser row says only that the piece changes tonight, while the night view
 * can name the clock time it changes at.
 */
export const componentWhere = (row: FinderRow, changesTag = 'changes tonight'): WhereReading => ({
  presence:
    row.where.kind === 'INSTALLED' ? 'ON_TELESCOPE' : row.where.kind === 'STORED' ? 'OFF_TELESCOPE' : 'NOT_RECORDED',
  label: whereLabel(row.where),
  changes: row.changesTonight ? changesTag : null,
});

/**
 * The status vocabulary, derived from the record rather than echoing the enum.
 *
 * `ResourceUsage` says what a record means for the schedule, but a browser
 * reader asks a different question - is this piece working? A stored piece is
 * `UNAVAILABLE` for science by definition, and printing that in red made every
 * lab spare look broken. So: a stored piece with nothing wrong is a "Spare";
 * red is kept for a piece that is actually out of service, and the record's
 * note - "Failed; removed for repair" - rides beside the tag, because a status
 * that cannot say why is not a status.
 *
 * One function for the browser row, the night table and the row's own history,
 * so the three cannot answer the same record differently.
 */
export const componentStatus = (
  usage: ResourceUsage | null,
  stored: boolean,
  note: string | null,
): RecordStatus | null => {
  switch (usage) {
    case null:
      return null;
    case 'SCIENCE':
      return { label: 'Science', severity: 'success', tone: 'normal' };
    case 'ENGINEERING':
      return { label: 'Engineering', severity: 'info', tone: 'normal' };
    default:
      return stored && note === null
        ? { label: 'Spare', tone: 'muted' }
        : { label: 'Unavailable', severity: 'danger', tone: 'alert' };
  }
};
