import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { OverlayPanel } from 'primereact/overlaypanel';
import type { MouseEventHandler } from 'react';
import { useRef } from 'react';

import { ChevronLeft, ChevronRight } from '@/components/Icons';

type ParamsInterface = React.PropsWithChildren<{
  title: React.ReactNode;
  prevPanel?: MouseEventHandler<HTMLButtonElement>;
  nextPanel?: MouseEventHandler<HTMLButtonElement>;
  rightSide?: React.ReactNode;
  className?: string;
}>;

export function Title({ title, prevPanel, nextPanel, children, rightSide, className = '' }: ParamsInterface) {
  let prevPanelDisplay = null;
  if (prevPanel) {
    prevPanelDisplay = (
      <button title="Previous panel" className="p-panel" onClick={prevPanel}>
        <i>
          <ChevronLeft />
        </i>
      </button>
    );
  }

  let nextPanelDisplay = null;
  if (nextPanel) {
    nextPanelDisplay = (
      <button title="Next panel" className="n-panel" onClick={nextPanel}>
        <i>
          <ChevronRight />
        </i>
      </button>
    );
  }
  return (
    <div className={cn(className, 'title')}>
      {children}
      {prevPanelDisplay}
      <span className="title-title">{title}</span>
      {rightSide}
      {nextPanelDisplay}
    </div>
  );
}

export function TitleDropdown({ children, icon }: React.PropsWithChildren<{ icon: React.ReactElement }>) {
  const op = useRef<OverlayPanel>(null);

  return (
    <span className="title-dropdown" aria-label="Settings" onClick={(e) => op.current?.toggle(e)}>
      <i>{icon}</i>
      <OverlayPanel ref={op}>{children}</OverlayPanel>
    </span>
  );
}
