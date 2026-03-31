import { isNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { useUpdateTarget } from '@gql/configs/Target';
import { RESET } from 'jotai/utils';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { lazy, startTransition, Suspense, useState } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { useTargetEdit } from '@/components/atoms/target';
import type { TargetType } from '@/types';

import { ModalSolarProgress } from '../ModalSolarProgress';

const TargetContent = lazy(() => import('../ModalContent').then((module) => ({ default: module.TargetContent })));

export function Target() {
  const canEdit = useCanEdit();

  const [targetEdit, setTargetEdit] = useTargetEdit();
  const [auxTarget, setAuxTarget] = useState<TargetType | null>(null);

  const [updateObservation, { loading }] = useUpdateObservation();

  const disabled = isNullish(targetEdit.target) || !canEdit;

  const close = () =>
    startTransition(() => {
      setTargetEdit(RESET);
      setAuxTarget(null);
    });

  const footer = (
    <div className="modal-footer">
      <Button text severity="danger" label="Cancel" onClick={close} />
      <Button
        label="Update"
        loading={loading}
        disabled={disabled}
        onClick={() => updateObservation(auxTarget!).then(close)}
      />
    </div>
  );

  return (
    <Dialog
      header={`Edit target ${targetEdit.target?.name ?? ''}`}
      visible={targetEdit.isVisible}
      footer={footer}
      modal
      onHide={close}
    >
      <Suspense fallback={<ModalSolarProgress />}>
        <TargetContent auxTarget={auxTarget} setAuxTarget={setAuxTarget} loading={loading} disabled={disabled} />
      </Suspense>
    </Dialog>
  );
}

function useUpdateObservation() {
  const [updateTarget, result] = useUpdateTarget();

  async function updateObservation(target: TargetType) {
    await updateTarget({
      variables: {
        ...target,
        sidereal: when(target.sidereal, (s) => ({
          coord1: s.ra?.degrees ?? s.az?.degrees,
          coord2: s.dec?.degrees ?? s.el?.degrees,
        })),
      },
    });
  }

  return [updateObservation, result] as const;
}
