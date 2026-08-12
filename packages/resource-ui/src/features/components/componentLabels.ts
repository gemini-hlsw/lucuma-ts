/**
 * The words every component table shares. Split from the cells because the
 * react-refresh rule wants component files exporting only components.
 */
import type { RecordStatus } from '@/components/ui/StatusTag';
import type { ComponentWhere } from '@/domain/componentFinder';
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

/** "Port 3 · GMOS" at Gemini South; GN's rows are not ports, so the name alone. */
export const whereLabel = (where: ComponentWhere): string => {
  switch (where.kind) {
    case 'INSTALLED':
      return where.port === null
        ? `On telescope · ${where.instrumentName}`
        : `Port ${where.port} · ${where.instrumentName}`;
    case 'STORED':
      return LOCATION_LABEL[where.location];
    default:
      return 'Not recorded';
  }
};

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
