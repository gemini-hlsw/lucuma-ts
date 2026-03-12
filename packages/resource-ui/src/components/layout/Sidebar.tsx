import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { JSX } from 'react';
import { NavLink, type NavLinkRenderProps } from 'react-router';

import { SIDEBAR_NAV_SECTIONS, type SidebarNavItem, type SidebarNavSection } from './SidebarNavigation';

interface SidebarBadgeProps {
  badge?: string;
}

interface SidebarNavItemContentProps {
  item: SidebarNavItem;
}

interface SidebarNavListItemProps {
  item: SidebarNavItem;
}

interface SidebarNavSectionBlockProps {
  section: SidebarNavSection;
}

/**
 * Builds the class string for a sidebar navigation link.
 *
 * @param props React Router NavLink render props.
 * @returns Tailwind class string for the navigation link.
 */
function getNavLinkClassName({ isActive }: NavLinkRenderProps): string {
  const baseClassName = 'flex items-center gap-2 border-l-2 px-4 py-2 text-sm';
  const inactiveClassName =
    'border-l-transparent text-foreground-secondary hover:bg-surface-raised hover:text-foreground';
  const activeClassName = 'border-l-gpp bg-gpp/40 text-white';

  return isActive ? `${baseClassName} ${activeClassName}` : `${baseClassName} ${inactiveClassName}`;
}

/**
 * Builds the class string for a disabled sidebar navigation item.
 *
 * @returns Tailwind class string for a disabled navigation item.
 */
function getDisabledNavItemClassName(): string {
  return 'flex cursor-not-allowed items-center gap-2 border-l-2 border-l-transparent px-4 py-2 text-sm text-foreground-muted';
}

/**
 * Renders an optional badge for a sidebar navigation item.
 *
 * @param props Badge props.
 * @returns Badge element or null.
 */
function SidebarBadge({ badge }: SidebarBadgeProps): JSX.Element | null {
  if (badge === undefined) {
    return null;
  }

  return (
    <span className="ml-auto rounded border border-subtle px-1.5 py-0.5 text-[10px] tracking-wide text-foreground-secondary uppercase">
      {badge}
    </span>
  );
}

/**
 * Renders the shared content for a sidebar navigation item.
 *
 * @param props Navigation item content props.
 * @returns Navigation item content fragment.
 */
function SidebarNavItemContent({ item }: SidebarNavItemContentProps): JSX.Element {
  return (
    <>
      {item.icon !== undefined && <FontAwesomeIcon icon={item.icon} className="h-4 w-4 shrink-0" />}
      <span>{item.label}</span>
      <SidebarBadge badge={item.badge} />
    </>
  );
}

/**
 * Renders a single sidebar navigation item.
 *
 * @param props Sidebar navigation item props.
 * @returns Sidebar navigation list item element.
 */
function SidebarNavListItem({ item }: SidebarNavListItemProps): JSX.Element {
  const content = <SidebarNavItemContent item={item} />;

  if (item.disabled === true) {
    return (
      <li>
        <div className={getDisabledNavItemClassName()} title="Coming soon" aria-disabled="true">
          {content}
        </div>
      </li>
    );
  }

  return (
    <li>
      <NavLink to={item.to} className={getNavLinkClassName}>
        {content}
      </NavLink>
    </li>
  );
}

/**
 * Renders a sidebar navigation section with a header and list of items.
 *
 * @param props Sidebar navigation section props.
 * @returns Sidebar navigation section element.
 */
function SidebarNavSectionBlock({ section }: SidebarNavSectionBlockProps): JSX.Element {
  return (
    <section>
      <p className="mb-3 px-4 font-mono text-xs tracking-widest text-foreground-muted uppercase">{section.title}</p>

      <ul className="m-0 list-none p-0">
        {section.items.map((item) => (
          <SidebarNavListItem key={item.to} item={item} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Renders the primary sidebar navigation for the Resource UI.
 *
 * @returns Sidebar element.
 */
export default function Sidebar(): JSX.Element {
  return (
    <div className="overflow-y-auto border-r border-subtle bg-surface py-4">
      <nav className="flex flex-col gap-4" aria-label="Primary navigation">
        {SIDEBAR_NAV_SECTIONS.map((section) => (
          <SidebarNavSectionBlock key={section.title} section={section} />
        ))}
      </nav>
    </div>
  );
}
