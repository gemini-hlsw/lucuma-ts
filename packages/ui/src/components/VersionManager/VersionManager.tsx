import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useVersion as useConfigsVersion } from '@gql/configs/Version';
import { useVersion as useServerVersion } from '@gql/server/Version';
import { Button } from 'primereact/button';
import type { ToastMessage } from 'primereact/toast';
import { Toast } from 'primereact/toast';
import { useCallback, useEffect, useRef } from 'react';

import { useToast } from '@/Helpers/toast';

import { RotateRight } from '../Icons';

// 1 minute
const pollInterval = 1000 * 60;

/**
 * Polls the server and configs version every minute, shows a toast to reload the page if the versions are different.
 */
export function VersionManager() {
  const toastRef = useRef<Toast>(null);
  const toast = useToast();

  const server = useServerVersion({ pollInterval });
  const serverVersion = server.data?.serverVersion;
  const prevServerVersion = server.previousData?.serverVersion;

  const configs = useConfigsVersion({ pollInterval });
  const configsVersion = configs.data?.version.serverVersion;
  const prevConfigsVersion = configs.previousData?.version.serverVersion;

  const checkAndShowNewVersion = useCallback(
    (prevVersion: string | null | undefined, newVersion: string | null | undefined, serverName: string) => {
      if (isNewVersion(prevVersion, newVersion)) {
        const newVersionAlert: ToastMessage = {
          id: `new-version`,
          severity: 'info',
          summary: `New ${serverName} version`,
          detail: (
            <div>
              <p>
                A new {serverName} version is available ({newVersion}). Please reload the page.
              </p>
              <Button icon={<RotateRight />} label="Reload" onClick={() => window.location.reload()} />
            </div>
          ),
          sticky: true,
        };
        toast?.show(newVersionAlert);
        return () => toast?.remove(newVersionAlert);
      }
      return;
    },
    [toast],
  );

  useEffect(
    () => checkAndShowNewVersion(prevServerVersion, serverVersion, 'server'),
    [serverVersion, prevServerVersion, checkAndShowNewVersion],
  );

  useEffect(
    () => checkAndShowNewVersion(prevConfigsVersion, configsVersion, 'configs server'),
    [prevConfigsVersion, configsVersion, checkAndShowNewVersion],
  );

  return <Toast ref={toastRef} />;
}

function isNewVersion(prevVersion: string | null | undefined, newVersion: string | null | undefined) {
  return prevVersion !== newVersion && isNotNullish(prevVersion) && isNotNullish(newVersion);
}
