import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBoxesStacked,
  faCalendarDays,
  faCalendarWeek,
  faMoon,
  faTelescope,
} from '@fortawesome/pro-regular-svg-icons';

export interface SidebarMenuItem {
  label: string;
  to: string;
  icon?: IconDefinition;
  disabled?: boolean;
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
      { label: 'Instruments', to: '/instruments', icon: faTelescope },
      { label: 'Components', to: '/components', icon: faBoxesStacked },
    ],
  },
];
