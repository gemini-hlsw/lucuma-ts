import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import type { JSX } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

const ACTIVE_CLASS_NAME = 'active';

/**
 * Determines whether a navigation item is active.
 *
 * @param pathname Current location pathname.
 * @param to Navigation target path.
 * @returns True if the item is active.
 */
function isItemActive(pathname: string, to: string): boolean {
  if (to === '/') {
    return pathname === '/';
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Builds the class string for a menu item's content container.
 *
 * @param isActive Whether the item is active.
 * @param isDisabled Whether the item is disabled.
 * @returns Tailwind class string for the menu item content.
 */
function getMenuContentClassName(isActive: boolean, isDisabled: boolean): string {
  const base = 'border-l-2 px-4 py-2 text-sm';

  if (isDisabled) {
    return cn(base, 'border-l-transparent text-foreground-muted');
  }

  if (isActive) {
    return cn(base, 'border-l-gpp bg-gpp/40 text-white');
  }

  return cn(base, 'border-l-transparent text-foreground-secondary hover:bg-surface-raised hover:text-foreground');
}

/**
 * Renders the primary sidebar navigation for the Resource UI.
 *
 * @returns Sidebar element.
 */
export default function Sidebar(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();

  // Build the menu model.
  const model: MenuItem[] = SIDEBAR_MENU_SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.map((item) => {
      const isActive = isItemActive(location.pathname, item.to);

      return {
        label: item.label,
        url: item.to,
        disabled: item.disabled,
        icon:
          item.icon === undefined ? undefined : (
            <FontAwesomeIcon icon={item.icon} className="h-4 w-4" aria-hidden="true" />
          ),
        className: isActive ? ACTIVE_CLASS_NAME : undefined,
        command: (event) => {
          event.originalEvent.preventDefault();

          if (!item.disabled) {
            void navigate(item.to);
          }
        },
      };
    }),
  }));

  return (
    <aside className="overflow-y-auto border-r border-subtle bg-surface py-2">
      <nav aria-label="Primary navigation">
        <Menu
          model={model}
          pt={{
            submenuHeader: {
              className: 'px-4 pb-2 pt-4 font-mono text-xs uppercase tracking-widest text-foreground-muted',
            },
            content: (options) => ({
              className: getMenuContentClassName(
                options?.context?.item?.className === ACTIVE_CLASS_NAME,
                options?.context?.item?.disabled === true,
              ),
            }),
            action: {
              className: 'flex items-center gap-2',
            },
          }}
        />
      </nav>
    </aside>
  );
}
