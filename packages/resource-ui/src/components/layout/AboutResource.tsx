import { Check, cn, Copy, VERSION_SUFFIX } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { type JSX, type ReactNode, useState } from 'react';

import { CURRENT_ENV, liveGraphqlEndpoint } from '@/app/environment';

const VERSION_BASE = import.meta.env.FRONTEND_VERSION;
const BUILD_SUFFIX = `-${VERSION_SUFFIX[CURRENT_ENV.name]}`;

const displayVersion = (): string => `${VERSION_BASE}${BUILD_SUFFIX}`;

interface AboutFact {
  readonly caption: string;
  readonly className?: string;
  readonly value: ReactNode;
}

const CAPTION_CELL = { className: 'w-0', role: 'rowheader' } as const;

const caption = (fact: AboutFact): JSX.Element => (
  <span className="text-xs font-semibold tracking-wider whitespace-nowrap text-foreground-secondary uppercase">
    {fact.caption}
  </span>
);

export function AboutResource({ visible, onHide }: { visible: boolean; onHide: () => void }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const CopyIcon = copied ? Check : Copy;
  const version = displayVersion();

  const copyVersion = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(version);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const facts: AboutFact[] = [
    { caption: 'Endpoint', className: 'font-mono wrap-anywhere', value: liveGraphqlEndpoint },
    {
      caption: 'Version',
      className: 'font-mono wrap-anywhere',
      value: (
        <>
          {VERSION_BASE}
          <span className="whitespace-nowrap">
            {BUILD_SUFFIX}
            <Button
              text
              type="button"
              size="small"
              className="xp-icon-btn ml-2 align-middle"
              title="Copy the version to the clipboard"
              aria-label="Copy version"
              onClick={() => void copyVersion()}
            >
              <CopyIcon size="xs" aria-hidden="true" />
            </Button>
          </span>
        </>
      ),
    },
    { caption: 'Environment', className: 'capitalize', value: CURRENT_ENV.name },
  ];

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      dismissableMask
      resizable={false}
      className="xp-about-dialog w-[min(30rem,92vw)]"
      header={<span className="xp-wordmark">Resource</span>}
      data-testid="about-resource"
    >
      <div className="flex flex-col gap-5 py-5">
        <p className="text-foreground-secondary">Telescope calendar and operational-resource manager.</p>
        <DataTable
          value={facts}
          showHeaders={false}
          size="small"
          cellMemo={false}
          className="w-full"
          data-testid="about-facts"
        >
          <Column pt={{ bodyCell: CAPTION_CELL }} body={caption} />
          <Column
            body={(fact: AboutFact) => <span className={cn('text-foreground', fact.className)}>{fact.value}</span>}
          />
        </DataTable>
      </div>
    </Dialog>
  );
}
