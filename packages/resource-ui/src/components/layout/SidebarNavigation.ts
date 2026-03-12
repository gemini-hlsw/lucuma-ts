import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCalendarDays, faMoonStars } from '@fortawesome/pro-regular-svg-icons';

/**
 * A single navigation item in the sidebar.
 */
export interface SidebarNavItem {
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

  /**
   * Optional badge content shown to the right of the label.
   */
  badge?: string;
}

/**
 * A section in the sidebar containing a header and multiple navigation items.
 */
export interface SidebarNavSection {
  /**
   * Section label shown above the items.
   */
  title: string;

  /**
   * Items rendered under the section.
   */
  items: SidebarNavItem[];
}

/**
 * Sidebar navigation configuration for the Resource UI.
 *
 * This is the single source of truth for sidebar structure.
 */
export const SIDEBAR_NAV_SECTIONS: SidebarNavSection[] = [
  {
    title: 'Overview',
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
    title: 'Telescope',
    items: [
      {
        label: 'Schedule',
        to: '/telescope-schedule',
        icon: faCalendarDays,
      },
    ],
  },
  {
    title: 'Instruments',
    items: [],
  },
  {
    title: 'Staff & Roles',
    items: [],
  },
];
