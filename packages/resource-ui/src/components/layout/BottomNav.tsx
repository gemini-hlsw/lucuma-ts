import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';
import { NavLink, useSearchParams } from 'react-router';

import { carrySelection, searchString } from '@/app/carriedSelection';
import { FOCUS_RING } from '@/components/ui/styles';

import type { SidebarMenuItem } from './SidebarMenu';
import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

/** The sections group the sidebar; a phone bar has room for the destinations alone. */
const ITEMS: SidebarMenuItem[] = SIDEBAR_MENU_SECTIONS.flatMap((section) => section.items);

/** Real `NavLink`s, so the router sets `aria-current` and the CSS highlight cannot go stale. */
function BottomNavItem({ item }: { item: SidebarMenuItem }): JSX.Element {
  const [params] = useSearchParams();
  const search = searchString(carrySelection(params));
  const content = (
    <>
      {item.icon === undefined ? null : <FontAwesomeIcon icon={item.icon} className="h-4 w-4" aria-hidden="true" />}
      <span>{item.label}</span>
    </>
  );

  if (item.disabled === true) {
    return (
      <a aria-disabled="true" className="xp-bottomnav-item">
        {content}
      </a>
    );
  }

  return (
    <NavLink to={{ pathname: item.to, search }} className={cn('xp-bottomnav-item', FOCUS_RING)}>
      {content}
    </NavLink>
  );
}

/** The phone's navigation. `shell.css` shows it below `md` alone, where the sidebar is gone. */
export default function BottomNav(): JSX.Element {
  return (
    <nav aria-label="Primary navigation" className="xp-bottomnav print:hidden">
      {ITEMS.map((item) => (
        <BottomNavItem key={item.to} item={item} />
      ))}
    </nav>
  );
}
