import type { SetTemporaryInstrumentMutationVariables } from '@gql/configs/gen/graphql';
import { useConfiguredInstrument, useSetTemporaryInstrument, useUpdateInstrument } from '@gql/configs/Instrument';
import { CommentConfirmButton } from '@Shared/CommentConfirmButton';
import { Title } from '@Shared/Title/Title';
import { Button } from 'primereact/button';
import type { InputNumberProps } from 'primereact/inputnumber';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { useId } from 'react';

import { useSetImportInstrument } from '@/components/atoms/instrument';
import { FloppyDisk, List } from '@/components/Icons';

export function InstrumentPanel({ canEdit }: { canEdit: boolean }) {
  const [updateInstrument, { loading: updateInstrumentLoading }] = useUpdateInstrument();
  const [setTemporaryInstrument, { loading: setTemporaryInstrumentLoading }] = useSetTemporaryInstrument();
  const setImportInstrument = useSetImportInstrument();

  const { data: instrument, loading: instrumentLoading } = useConfiguredInstrument();

  const loading = instrumentLoading || updateInstrumentLoading || setTemporaryInstrumentLoading;

  // When changing any field, update the instrument as a temporary instrument
  const onUpdateInstrument = async (variables: Partial<SetTemporaryInstrumentMutationVariables>) => {
    if (instrument) {
      await setTemporaryInstrument({
        variables: {
          ...instrument,
          ...variables,
        },
      });
    }
  };

  const saveInstrument = async (comment: string | null) => {
    if (instrument) {
      await updateInstrument({
        variables: { pk: instrument.pk, comment, isTemporary: false },
        optimisticResponse: { updateInstrument: { ...instrument, comment, isTemporary: false } },
      });
    }
  };

  const saveButton = (
    <CommentConfirmButton
      loading={loading}
      disabled={!instrument?.isTemporary}
      icon={<FloppyDisk />}
      onConfirm={saveInstrument}
      tooltip="Save instrument"
      message="Save as a permanent configuration?"
    />
  );

  return (
    <div className="instrument">
      <Title title="Instrument" rightSide={saveButton}>
        <Button
          icon={<List />}
          text
          style={{ color: 'white' }}
          disabled={!canEdit}
          aria-label="Import Instrument"
          tooltip="Import Instrument"
          onClick={() => setImportInstrument(true)}
        />
      </Title>
      <div className="body">
        <label className="label" htmlFor="instrument-name">
          SF Name
        </label>
        <InputText id="instrument-name" disabled={true} value={instrument?.name ?? ''} />

        <InstrumentInputNumber value={instrument?.issPort} label="Port" disabled={true} minFractionDigits={0} />

        <InstrumentInputNumber
          label="Origin X"
          value={instrument?.originX ?? null}
          disabled={!canEdit || loading}
          onValueChange={(e) => onUpdateInstrument({ originX: e.value! })}
        />
        <InstrumentInputNumber
          label="Origin Y"
          value={instrument?.originY ?? null}
          disabled={!canEdit || loading}
          onValueChange={(e) => onUpdateInstrument({ originY: e.value! })}
        />
        <InstrumentInputNumber
          label="Focus Offset"
          value={instrument?.focusOffset ?? null}
          disabled={!canEdit || loading}
          onValueChange={(e) => onUpdateInstrument({ focusOffset: e.value! })}
        />
        <InstrumentInputNumber
          label="IAA"
          value={instrument?.iaa ?? null}
          disabled={!canEdit || loading}
          onValueChange={(e) => onUpdateInstrument({ iaa: e.value! })}
        />
      </div>
    </div>
  );
}

function InstrumentInputNumber({ label, ...props }: { label: string } & InputNumberProps) {
  const id = useId();
  return (
    <>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <InputNumber inputId={id} minFractionDigits={2} maxFractionDigits={5} mode="decimal" {...props} />
    </>
  );
}
