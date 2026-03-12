import { faLayerGroup } from '@fortawesome/pro-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { JSX } from 'react';

const BRAND_LABEL = 'Resource';

/**
 * Renders the application navbar with the Resource brand.
 *
 * @returns Navbar element.
 */
export default function Navbar(): JSX.Element {
  return (
    <header className="flex h-10 border-b border-subtle bg-surface px-4">
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faLayerGroup} className="text-sm text-gpp" aria-hidden="true" />

        <span className="text-sm font-semibold tracking-[0.4em] uppercase">{BRAND_LABEL}</span>
      </div>
    </header>
  );
}
