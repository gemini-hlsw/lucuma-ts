import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { type JSX, type ReactNode, useState } from 'react';

/**
 * Explore-style tile: a titled panel with a header bar (uppercase,
 * letter-spaced title + optional controls) and a collapsible body — the
 * layout primitive every view is built from. Styling in styles/shell.css.
 */
export function Tile({
  title,
  controls,
  children,
  flush = false,
  collapsible = true,
}: {
  title: string;
  controls?: ReactNode;
  children: ReactNode;
  /** Remove body padding (e.g. when the body is a full-bleed table). */
  flush?: boolean;
  collapsible?: boolean;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="xp-tile">
      <div className="xp-tile-title">
        <span className="xp-tile-title-text">{title}</span>
        <div className="xp-tile-controls">
          {controls}
          {collapsible && (
            <button
              type="button"
              className="xp-icon-btn"
              title={collapsed ? 'Expand this panel' : 'Collapse this panel'}
              onClick={() => setCollapsed((c) => !c)}
            >
              <i className={cn('pi', collapsed ? 'pi-chevron-down' : 'pi-chevron-up')} />
            </button>
          )}
        </div>
      </div>
      {!collapsed && <div className={cn('xp-tile-body', flush && 'is-flush')}>{children}</div>}
    </section>
  );
}
