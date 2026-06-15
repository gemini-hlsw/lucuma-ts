import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { lazy, startTransition, Suspense, useState } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { useOdbVisible } from '@/components/atoms/odb';
import type { OdbObservation } from '@/types';

import { ModalSolarProgress } from '../ModalSolarProgress';
import { useImportObservation } from './useImportObservation';

const ObservationTable = lazy(() => import('../ModalContent').then((module) => ({ default: module.ObservationTable })));

export function OdbImport() {
  const canEdit = useCanEdit();
  const [odbVisible, setOdbVisible] = useOdbVisible();
  const [selectedObservation, setSelectedObservation] = useState<OdbObservation | null>(null);

  const [importObservation, { loading }] = useImportObservation();

  const close = () =>
    startTransition(() => {
      setOdbVisible(false);
      setSelectedObservation(null);
    });

  const importAndClose = (observation: OdbObservation) => {
    if (!canEdit) return;
    return importObservation(observation).then(close);
  };

  const footer = (
    <div className="modal-footer">
      <Button text severity="danger" label="Cancel" onClick={close} />
      <Button
        disabled={!canEdit || !selectedObservation}
        label="Import to Navigate"
        loading={loading}
        onClick={() => importAndClose(selectedObservation!)}
      />
    </div>
  );

  return (
    <Dialog header="Import from ODB" footer={footer} visible={odbVisible} modal onHide={close}>
      <Suspense fallback={<ModalSolarProgress />}>
        <ObservationTable
          selectedObservation={selectedObservation}
          setSelectedObservation={setSelectedObservation}
          onImport={importAndClose}
          loading={loading}
        />
      </Suspense>
    </Dialog>
  );
}
