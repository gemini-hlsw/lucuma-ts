import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBoxesStacked,
  faCalendarDays,
  faCalendarWeek,
  faMoon,
  faTelescope,
} from '@fortawesome/pro-regular-svg-icons';

/**
 * A single sidebar menu item.
 */
export interface SidebarMenuItem {
  /** Human-readable label shown in the sidebar. */
  label: string;
  /** Route path for the navigation item. */
  to: string;
  /** Optional Font Awesome icon displayed to the left of the label. */
  icon?: IconDefinition;
  /** Whether the navigation item is disabled. */
  disabled?: boolean;
}

/**
 * A sidebar menu section: a heading and its links, nothing else - captions
 * under the headings were removed at Dan's direction (2026-08-11).
 */
interface SidebarMenuSection {
  /** Section label shown above the items. */
  label: string;
  /** Items rendered under the section. */
  items: SidebarMenuItem[];
}

/**
 * Sidebar menu configuration for the Resource UI.
 *
 * Semester first - the readable reproduction of the published sheet - then the
 * same data at narrower windows.
 *
 * Nothing here is gated, and nothing should become gated: gating navigation on
 * whether a schedule exists left the reader stranded on one view with no way to
 * reach the others. Each view states plainly when nothing is recorded.
 */
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
