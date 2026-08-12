/**
 * The words every component table shares. Split from the cells because the
 * react-refresh rule wants component files exporting only components.
 */
import type { ComponentWhere } from '@/domain/componentFinder';
import type { ComponentType } from '@/domain/types';

export const TYPE_LABEL: Record<ComponentType, string> = {
  FILTER: 'Filter',
  DISPERSER: 'Disperser',
  FPU: 'FPU',
  WFS: 'WFS',
  OTHER: 'Other',
};

export const PLACE_LABEL = {
  SUMMIT_LAB: 'Summit lab',
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
      return PLACE_LABEL[where.place];
    default:
      return 'Not recorded';
  }
};
