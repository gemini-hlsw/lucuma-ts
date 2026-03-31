import { when } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguredInstrument, useUpdateInstrument } from '@gql/configs/Instrument';
import {
  useAbsorbOriginAdjustment,
  useAdjustOrigin,
  useOriginAdjustmentOffset,
  useResetOriginAdjustment,
} from '@gql/server/OriginHandset';
import { Button } from 'primereact/button';
import { ButtonGroup } from 'primereact/buttongroup';
import { useState } from 'react';

import {
  AlignAngleInput,
  AlignmentSelector,
  Autoadjust,
  CurrentCoordinates,
  InputControls,
  OpenLoopsInput,
} from './Controls';
import type { Coords, HandsetStrategy } from './strategy';
import { strategies } from './strategy';

export default function InstrumentHandset({ canEdit }: { canEdit: boolean }) {
  // GraphQL Queries
  const { data: offset, loading: offsetLoading } = useOriginAdjustmentOffset();
  const { data: instrument, loading: instrumentLoading } = useConfiguredInstrument();

  // GraphQL Mutations
  const [adjustOrigin, { loading: adjustOriginLoading }] = useAdjustOrigin();
  const [resetAdjustment, { loading: resetAdjustmentLoading }] = useResetOriginAdjustment();
  const [absorbAdjustment, { loading: absorbAdjustmentLoading }] = useAbsorbOriginAdjustment();
  const [updateInstrument, { loading: updateInstrumentLoading }] = useUpdateInstrument();

  // State
  const defaultAlignment = 'AC';
  const [strategy, setStrategy] = useState<HandsetStrategy>(strategies[defaultAlignment]);
  const [openLoops, setOpenLoops] = useState(true);

  const alignAngleEnabled = strategy.name === 'OIWFS';

  const handleApply = async (coords: Coords) =>
    adjustOrigin({
      variables: {
        offset: strategy.toInput(
          coords,
          when(alignAngleEnabled, () => instrument?.alignAngle),
        ),
        openLoops,
      },
    });

  const loading =
    offsetLoading ||
    adjustOriginLoading ||
    resetAdjustmentLoading ||
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

      <OpenLoopsInput openLoops={openLoops} onChange={setOpenLoops} loading={loading} canEdit={canEdit} />

      <CurrentCoordinates
        horizontal={offset?.deltaX.arcseconds}
        vertical={offset?.deltaY.arcseconds}
        horizontalLabel="X"
        verticalLabel="Y"
      />

      <div className="control-row buttons">
        <ButtonGroup>
          <Button
            size="small"
            label="Reset"
            disabled={loading || !canEdit}
            onClick={() => resetAdjustment({ variables: { openLoops } })}
          />
          <Button size="small" label="Absorb" disabled={loading || !canEdit} onClick={() => absorbAdjustment()} />
        </ButtonGroup>
      </div>

      <Autoadjust />
    </div>
  );
}
