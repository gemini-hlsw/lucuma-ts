import { useConfiguration, useUpdateConfiguration } from '@gql/configs/Configuration';
import { GET_INSTRUMENT, useSetTemporaryInstrument } from '@gql/configs/Instrument';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { lazy, startTransition, Suspense, useState } from 'react';

import { useImportInstrument } from '@/components/atoms/instrument';
import { useTransitionPromise } from '@/Helpers/hooks';
import { useToast } from '@/Helpers/toast';
import type { InstrumentConfig } from '@/types';

import { ModalSolarProgress } from '../ModalSolarProgress';

const InstrumentContent = lazy(() =>
  import('../ModalContent').then((module) => ({ default: module.InstrumentContent })),
);

export function Instrument() {
  const [importInstrument, setImportInstrument] = useImportInstrument();

  const [instrument, setInstrument] = useState<InstrumentConfig | null>(null);

  const [modifyInstrument, { loading }] = useModifyInstrument();

  const close = () =>
    startTransition(() => {
      setImportInstrument(false);
      setInstrument(null);
    });

  const footer = (
    <div className="modal-footer">
      <Button text severity="danger" label="Cancel" onClick={close} />
      <Button
        label="Import"
        disabled={!instrument}
        loading={loading}
        onClick={() => modifyInstrument(instrument!).then(close)}
        data-testid="import-button"
      />
    </div>
  );

  return (
    <Dialog header="Import instrument" visible={importInstrument} footer={footer} modal onHide={close}>
      <Suspense fallback={<ModalSolarProgress />}>
        <InstrumentContent instrument={instrument} setInstrument={setInstrument} />
      </Suspense>
    </Dialog>
  );
}

function useModifyInstrument() {
  const { data: configurationData, loading: configurationLoading } = useConfiguration();
  const configuration = configurationData?.configuration;

  const [setTemporaryInstrument, { loading: setTemporaryInstrumentLoading }] = useSetTemporaryInstrument();
  const [updateConfiguration, { loading: updateConfigurationLoading }] = useUpdateConfiguration();

  const toast = useToast();

  const [isPending, startTransition] = useTransitionPromise();

  const loading = setTemporaryInstrumentLoading || updateConfigurationLoading || configurationLoading || isPending;

  const modifyInstrument = (instrument: InstrumentConfig) => {
    if (!configuration) return Promise.resolve();

    return startTransition(async () => {
      await Promise.all([
        setTemporaryInstrument({
          variables: {
            ...instrument,
          },
        }),
        updateConfiguration({
          variables: {
            pk: configuration.pk,
            obsInstrument: instrument.name,
          },
          refetchQueries: [GET_INSTRUMENT],
          awaitRefetchQueries: true,
        }),
      ]);

      if (instrument.comment?.includes('Default fallback configuration')) {
        toast?.show({
          severity: 'warn',
          summary: 'Warning',
          detail: instrument.comment,
        });
      }
    });
  };

  return [modifyInstrument, { loading }] as const;
}
