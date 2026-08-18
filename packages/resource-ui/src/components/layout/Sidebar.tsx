import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';
import { NavLink, useLocation } from 'react-router';

import type { SidebarMenuItem } from './SidebarMenu';
import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

/** Shared item box: a thin left accent + compact padding (the original look). */
const ITEM_BASE =
  'flex items-center gap-2 border-l-2 px-4 py-2 text-sm max-md:border-l-0 max-md:border-b-2 max-md:whitespace-nowrap';

/**
 * Builds the class string for a navigation item.
 *
 * @param isActive Whether the item is the current route.
 * @param isDisabled Whether the item is disabled.
 * @returns Tailwind class string for the item.
 */
function itemClassName(isActive: boolean, isDisabled: boolean): string {
  if (isDisabled) {
    return cn(ITEM_BASE, 'border-l-transparent text-foreground-muted max-md:border-b-transparent');
  }

  if (isActive) {
    return cn(ITEM_BASE, 'border-l-gpp bg-gpp/40 text-white max-md:border-b-gpp');
  }

  return cn(
    ITEM_BASE,
    'border-l-transparent text-foreground-secondary hover:bg-surface-raised hover:text-foreground max-md:border-b-transparent',
  );
}

/**
 * A single sidebar entry. Enabled items are real `NavLink`s so the active
 * highlight follows the router reliably - React Router recomputes `isActive` on
 * every navigation, unlike the previous PrimeReact `Menu`, whose passthrough
 * styling went stale when moving between items. Disabled items render as inert
 * anchors (no href) marked `aria-disabled`.
 */
function SidebarItem({ item }: { item: SidebarMenuItem }): JSX.Element {
  // Carry the query string across views: site, semester and night live in
  // the URL, and switching views must never reset them to defaults.
  const { search } = useLocation();
  const icon =
    item.icon === undefined ? null : <FontAwesomeIcon icon={item.icon} className="h-4 w-4" aria-hidden="true" />;

  if (item.disabled === true) {
    return (
      <a aria-disabled="true" className={itemClassName(false, true)}>
        {icon}
        {item.label}
      </a>
    );
  }

  return (
    <NavLink to={{ pathname: item.to, search }} className={({ isActive }) => itemClassName(isActive, false)}>
      {icon}
      {item.label}
    </NavLink>
  );
}

/**
 * Renders the primary sidebar navigation for the Resource UI.
 *
 * @returns Sidebar element.
 */
export default function Sidebar(): JSX.Element {
  // Nothing is gated: every destination is a reading view over whatever the
  // published schedule holds, and each page says plainly when that is nothing.
  const sections = SIDEBAR_MENU_SECTIONS;

  // Desktop: the fixed vertical rail. Small screens: the same items as one
  // horizontally scrollable tab row under the masthead (section headings drop,
  // the active item keeps its accent), so navigation survives narrow windows.
  return (
    <aside className="overflow-y-auto border-r border-subtle bg-surface py-2 max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:py-0">
      <nav aria-label="Primary navigation" className="max-md:flex max-md:w-max max-md:flex-row">
        {sections.map((section, index) => (
          <div key={section.label || index} className="max-md:flex max-md:flex-row max-md:items-center">
            {section.label !== '' && (
              <div className="px-4 pt-4 pb-2 max-md:hidden">
                <div className="font-mono text-xs tracking-widest text-foreground-muted uppercase">{section.label}</div>
              </div>
            )}
            {section.items.map((item) => (
              <SidebarItem key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>
      {/* Where every record comes from, stated so no page can be read without
          knowing it. The server decides what it serves, so this names the
          endpoint rather than claiming a provenance the app cannot see. */}
      <p
        className="px-4 pt-6 pb-2 text-[11px] leading-4 text-foreground-muted max-md:hidden"
        data-testid="data-source-note"
      >
        Reading the live server at
        <br />
        <span className="font-mono">/resource/graphql</span>
      </p>
    </aside>
  );
}
