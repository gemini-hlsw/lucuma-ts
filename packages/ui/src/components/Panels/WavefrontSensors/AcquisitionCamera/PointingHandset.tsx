import { when } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguredInstrument, useUpdateInstrument } from '@gql/configs/Instrument';
import {
  useAbsorbGuidePointingAdjustment,
  useAdjustPointing,
  usePointingAdjustmentOffset,
  useResetGuidePointingAdjustment,
  useResetLocalPointingAdjustment,
} from '@gql/server/PointingHandset';
import { Button } from 'primereact/button';
import { useState } from 'react';

import { AlignAngleInput, AlignmentSelector, CorrectionTable, InputControls } from './Controls';
import { type Coords, type HandsetStrategy, strategies } from './strategy';

export default function PointingHandset({ canEdit }: { canEdit: boolean }) {
  // GraphQL Queries
  const { data: offset, loading: offsetLoading } = usePointingAdjustmentOffset();
  const { data: instrument, loading: instrumentLoading } = useConfiguredInstrument();

  // GraphQL Mutations
  const [adjustPointing, { loading: adjustPointingLoading }] = useAdjustPointing();
  const [resetLocalAdjustment, { loading: resetLocalAdjustmentLoading }] = useResetLocalPointingAdjustment();
  const [resetGuideAdjustment, { loading: resetGuideAdjustmentLoading }] = useResetGuidePointingAdjustment();
  const [absorbAdjustment, { loading: absorbAdjustmentLoading }] = useAbsorbGuidePointingAdjustment();
  const [updateInstrument, { loading: updateInstrumentLoading }] = useUpdateInstrument();

  // State
  const defaultAlignment = 'Az/El';
  const [strategy, setStrategy] = useState<HandsetStrategy>(strategies[defaultAlignment]);

  const alignAngleEnabled = strategy.name === 'OIWFS';

  const handleApply = (coords: Coords) =>
    adjustPointing({
      variables: {
        offset: strategy.toInput(
          coords,
          when(alignAngleEnabled, () => instrument?.alignAngle),
        ),
      },
    });

  const loading =
    offsetLoading ||
    adjustPointingLoading ||
    resetLocalAdjustmentLoading ||
    resetGuideAdjustmentLoading ||
    absorbAdjustmentLoading ||
    instrumentLoading ||
    updateInstrumentLoading;

  return (
    <div className="handset">
      <div className="selector-group">
        <AlignmentSelector
          defaultAlignment={defaultAlignment}
          onChange={setStrategy}
          loading={loading}
          canEdit={canEdit}
          instrumentWfs={instrument?.wfs}
        />

        {alignAngleEnabled && (
          <AlignAngleInput
            disabled={loading || !canEdit || !instrument}
            value={instrument?.alignAngle ?? null}
            // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
            onChange={(value) => updateInstrument({ variables: { pk: instrument?.pk!, alignAngle: value } })}
          />
        )}
      </div>

      <InputControls loading={loading} handleApply={handleApply} strategy={strategy} canEdit={canEdit} />

      <CorrectionTable
        localHorizontal={offset?.local.azimuth.arcseconds}
        localVertical={offset?.local.elevation.arcseconds}
        guideHorizontal={offset?.guide.azimuth.arcseconds}
        guideVertical={offset?.guide.elevation.arcseconds}
        localReset={
          <Button size="small" label="Reset" onClick={() => resetLocalAdjustment()} disabled={loading || !canEdit} />
        }
        guideReset={
          <Button size="small" label="Reset" onClick={() => resetGuideAdjustment()} disabled={loading || !canEdit} />
        }
        guideAbsorb={
          <Button
            size="small"
            label="Absorb guide into local"
            onClick={() => absorbAdjustment()}
            disabled={loading || !canEdit}
          />
        }
      />
    </div>
  );
}
