import { formatDateTime, when } from '@gemini-hlsw/lucuma-common-ui';
import { useRevertCalParams } from '@gql/configs/CalParams';
import type { CalParamsHistory as CalParamsHistoryType } from '@gql/configs/gen/graphql';
import { CommentConfirmButton } from '@Shared/CommentConfirmButton';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { lazy, startTransition, Suspense, useState } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { useCalParamsHistoryVisible } from '@/components/atoms/calparams';
import { useToast } from '@/Helpers/toast';

import { ModalSolarProgress } from '../ModalSolarProgress';

const CalParamsHistoryContent = lazy(() =>
  import('../ModalContent').then((module) => ({ default: module.CalParamsHistoryContent })),
);

export function CalParamsHistory() {
  const [visible, setVisible] = useCalParamsHistoryVisible();
  const canEdit = useCanEdit();

  const [selection, setSelection] = useState<CalParamsHistoryType | null>(null);

  const [onRevertParams, { loading }] = useRevertParams();

  const close = () =>
    startTransition(() => {
      setVisible(false);
      setSelection(null);
    });

  const footer = (
    <div className="modal-footer">
      <Button text severity="danger" label="Cancel" onClick={close} />
      <CommentConfirmButton
        label="Revert"
        disabled={!selection || !canEdit || loading}
        loading={loading}
        message="Comment:"
        onConfirm={(msg) => onRevertParams(msg, selection!).then(close)}
        initialComment={when(
          selection,
          ({ createdAt, comment }) => `Reverted to parameters from ${formatDateTime(createdAt, false)}\n\n${comment}`,
        )}
      />
    </div>
  );

  return (
    <Dialog header="Revert to previous calibration parameters" visible={visible} onHide={close} footer={footer}>
      <Suspense fallback={<ModalSolarProgress />}>
        <CalParamsHistoryContent
          canEdit={canEdit}
          loading={loading}
          selection={selection}
          setSelection={setSelection}
        />
      </Suspense>
    </Dialog>
  );
}

function useRevertParams() {
  const [revertParams, { loading }] = useRevertCalParams();
  const toast = useToast();

  const onRevertParams = async (comment: string | null, selection: CalParamsHistoryType) => {
    await revertParams({ variables: { pk: selection.pk, comment } });
    toast?.show({
      severity: 'success',
      summary: 'Reverted',
      detail: (
        <div>
          <div>Rolled back parameters:</div>
          <br />
          <div>{comment}</div>
        </div>
      ),
      life: 10000,
    });
  };

  return [onRevertParams, { loading }] as const;
}
