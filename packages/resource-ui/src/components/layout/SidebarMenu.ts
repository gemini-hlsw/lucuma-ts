import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBoxesStacked,
  faCalendarDays,
  faCalendarWeek,
  faMoon,
  faTelescope,
} from '@fortawesome/pro-regular-svg-icons';

import type { CarriedParam } from '@/app/carriedSelection';

export interface SidebarMenuItem {
  label: string;
  to: string;
  icon?: IconDefinition;
  disabled?: boolean;
  /** The selection the link carries, when the destination reads less than the default. */
  carries?: readonly CarriedParam[];
}

interface SidebarMenuSection {
  label: string;
  items: SidebarMenuItem[];
}

/** Nothing is gated: gating on whether a schedule exists strands the reader on one view. */
export const SIDEBAR_MENU_SECTIONS: SidebarMenuSection[] = [
  {
    label: 'Schedule',
    items: [
      { label: 'Semester', to: '/semester', icon: faCalendarDays },
      { label: 'Week', to: '/week', icon: faCalendarWeek },
      { label: 'Night', to: '/night', icon: faMoon },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Instruments', to: '/instruments', icon: faTelescope, carries: ['site'] },
      { label: 'Components', to: '/components', icon: faBoxesStacked, carries: ['site'] },
    ],
  },
];
