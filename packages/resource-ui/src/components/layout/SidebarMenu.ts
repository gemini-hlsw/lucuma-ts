import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCalendarDays, faMoonStars, faWrench } from '@fortawesome/pro-regular-svg-icons';

/**
 * A single sidebar menu item.
 */
export interface SidebarMenuItem {
  /**
   * Human-readable label shown in the sidebar.
   */
  label: string;

  /**
   * Route path for the navigation item.
   */
  to: string;

  /**
   * Optional Font Awesome icon displayed to the left of the label.
   */
  icon?: IconDefinition;

  /**
   * Whether the navigation item is disabled.
   */
  disabled?: boolean;
}

/**
 * A sidebar menu section.
 */
export interface SidebarMenuSection {
  /**
   * Section label shown above the items.
   */
  label: string;

  /**
   * Items rendered under the section.
   */
  items: SidebarMenuItem[];
}

/**
 * Sidebar menu configuration for the Resource UI.
 *
 * This is the single source of truth for sidebar structure.
 */
export const SIDEBAR_MENU_SECTIONS: SidebarMenuSection[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Tonight',
        to: '/tonight',
        icon: faMoonStars,
        disabled: true,
      },
    ],
  },
  {
    label: 'Telescope',
    items: [
      {
        label: 'Schedule',
        to: '/telescope-schedule',
        icon: faCalendarDays,
      },
      {
        label: 'Test',
        to: '/test',
        icon: faWrench,
        disabled: true,
      },
    ],
  },
  {
    label: 'Instruments',
    items: [],
  },
  {
    label: 'Staff & Roles',
    items: [],
  },
];
