import { faLayerGroup } from '@fortawesome/pro-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Menubar } from 'primereact/menubar';
import type { MenuItem } from 'primereact/menuitem';
import type { JSX } from 'react';

const BRAND_LABEL = 'Resource';

/**
 * Renders the application navbar with the Resource brand.
 *
 * @returns Navbar element.
 */
export default function Navbar(): JSX.Element {
  const items: MenuItem[] = [];

  const start = (
    <div className="flex items-center gap-2">
      <FontAwesomeIcon icon={faLayerGroup} className="text-sm text-gpp" aria-hidden="true" />

      <span className="text-sm font-semibold tracking-[0.4em] uppercase">{BRAND_LABEL}</span>
    </div>
  );

  return (
    <Menubar
      model={items}
      start={start}
      className="min-h-10 rounded-none border-x-0 border-t-0 border-b border-subtle bg-surface px-4"
    />
  );
}
