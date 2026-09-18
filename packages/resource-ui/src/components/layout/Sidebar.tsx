import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';
import { NavLink, useSearchParams } from 'react-router';

import { carrySelection, searchString } from '@/app/carriedSelection';

import type { SidebarMenuItem } from './SidebarMenu';
import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

const ITEM_BASE = 'flex items-center gap-2 border-l-2 px-4 py-2 text-xs';

function itemClassName(isActive: boolean, isDisabled: boolean): string {
  if (isDisabled) {
    return cn(ITEM_BASE, 'border-l-transparent text-foreground-muted');
  }

  if (isActive) {
    return cn(ITEM_BASE, 'border-l-gpp bg-gpp/40 text-white');
  }

  return cn(ITEM_BASE, 'border-l-transparent text-foreground-secondary hover:bg-surface-raised hover:text-foreground');
}

/** Real `NavLink`s, so React Router recomputes `isActive` and the highlight cannot go stale. */
function SidebarItem({ item }: { item: SidebarMenuItem }): JSX.Element {
  const [params] = useSearchParams();
  const search = searchString(carrySelection(params));
  const icon = item.icon === undefined ? null : <FontAwesomeIcon icon={item.icon} size="sm" aria-hidden="true" />;

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

export default function Sidebar(): JSX.Element {
  const sections = SIDEBAR_MENU_SECTIONS;

  // Desktop only: below `md` the phone's own bar (`BottomNav`) is the one navigation.
  return (
    <aside className="overflow-y-auto border-r border-subtle bg-surface py-2 max-md:hidden">
      <nav aria-label="Primary navigation">
        {sections.map((section, index) => (
          <div key={section.label || index}>
            {section.label !== '' && (
              <div className="px-4 pt-4 pb-2">
                <div className="font-mono text-xs tracking-widest text-foreground-secondary uppercase">
                  {section.label}
                </div>
              </div>
            )}
            {section.items.map((item) => (
              <SidebarItem key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
