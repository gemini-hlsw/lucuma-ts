import './AcquisitionAdjustmentToast.css';

import { formatToSignedArcseconds, isNotNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguredInstrument, useUpdateInstrument } from '@gql/configs/Instrument';
import { useRotator, useUpdateRotator } from '@gql/configs/Rotator';
import type { useAcquisitionAdjustmentState } from '@gql/server/AcquisitionAdjustment';
import { useAcquisitionAdjustment } from '@gql/server/AcquisitionAdjustment';
import type { AcquistionAdjustmentCommand } from '@gql/server/gen/graphql';
import { Button } from 'primereact/button';

import { Check, XMark } from '../Icons';

type AcquisitionAdjustmentState = NonNullable<
  ReturnType<typeof useAcquisitionAdjustmentState>['data']
>['acquisitionAdjustmentState'];

export function AcquisitionAdjustmentPrompt({ state }: { state: AcquisitionAdjustmentState }) {
  const { data: rotatorData, loading: rotatorLoading } = useRotator();
  const rotatorPk = rotatorData?.rotator?.pk;
  const { data: instrument, loading: instrumentLoading } = useConfiguredInstrument();

  const [adjustAcquisition, { loading: adjustAcqLoading }] = useAcquisitionAdjustment();

  const [updateRotator, { loading: updateRotatorLoading }] = useUpdateRotator();
  const [updateInstrument, { loading: updateInstrumentLoading }] = useUpdateInstrument();

  const loading =
    adjustAcqLoading || updateRotatorLoading || rotatorLoading || instrumentLoading || updateInstrumentLoading;

  const adjustCommand = (command: AcquistionAdjustmentCommand) =>
    adjustAcquisition({
      variables: {
        input: {
          offset: {
            p: { arcseconds: state.offset.p.arcseconds },
            q: { arcseconds: state.offset.q.arcseconds },
          },
          iaa: when(state.iaa, (iaa) => ({ degrees: iaa.degrees })),
          ipa: when(state.ipa, (ipa) => ({ degrees: ipa.degrees })),
          command,
        },
      },
    });

  return (
    <>
      <div className="acquisition-adjustment-prompt">
        <div>P:</div>
        <div>{formatToSignedArcseconds(state.offset.p.arcseconds)}</div>
        <div>Q:</div>
        <div>{formatToSignedArcseconds(state.offset.q.arcseconds)}</div>
        <div>IPA:</div>
        <div>{formatToSignedArcseconds(state.ipa?.degrees)}</div>
        <div>IAA:</div>
        <div>{formatToSignedArcseconds(state.iaa?.degrees)}</div>
      </div>
      <div className="acquisition-adjustment-buttons">
        <Button
          loading={loading}
          icon={<XMark />}
          severity="secondary"
          label="Cancel"
          size="small"
          onClick={() => adjustCommand('USER_CANCELS')}
        />
        <Button
          loading={loading}
          icon={<Check />}
          label="Accept"
          size="small"
          onClick={() =>
            Promise.all([
              adjustCommand('USER_CONFIRMS'),
              when(isNotNullish(rotatorPk) && state.ipa, (ipa) =>
                updateRotator({ variables: { pk: rotatorPk!, angle: parseFloat(ipa.degrees as string) } }),
              ),
              when(isNotNullish(instrument?.pk) && state.iaa, (iaa) =>
                updateInstrument({ variables: { pk: instrument!.pk, iaa: parseFloat(iaa.degrees as string) } }),
              ),
            ])
          }
        />
      </div>
    </>
  );
}
