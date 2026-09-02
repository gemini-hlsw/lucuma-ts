import type { RecordStatus } from '@/components/ui/StatusTag';
import type { WhereReading } from '@/components/ui/WhereCell';
import type { ComponentWhere, FinderRow } from '@/domain/componentFinder';
import { STORAGE_PLACE_LABEL } from '@/domain/places';
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
  ...STORAGE_PLACE_LABEL,
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

/** `changesTag` is the caller's: a browser row says it changes, the night view names when. */
export const componentWhere = (row: FinderRow, changesTag = 'changes tonight'): WhereReading => ({
  presence:
    row.where.kind === 'INSTALLED' ? 'ON_TELESCOPE' : row.where.kind === 'STORED' ? 'OFF_TELESCOPE' : 'NOT_RECORDED',
  label: whereLabel(row.where),
  changes: row.changesTonight ? changesTag : null,
});

/** A stored piece is UNAVAILABLE by definition, so red is kept for one actually out of service. */
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
