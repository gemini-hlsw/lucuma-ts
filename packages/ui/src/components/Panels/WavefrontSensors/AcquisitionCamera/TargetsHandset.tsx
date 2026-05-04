import { isNotNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguration } from '@gql/configs/Configuration';
import type { ConfigurationItemFragment } from '@gql/configs/gen/graphql';
import { useConfiguredInstrument, useUpdateInstrument } from '@gql/configs/Instrument';
import type { AdjustTarget, GetTargetAdjustmentOffsetsQuery } from '@gql/server/gen/graphql';
import {
  useAbsorbTargetAdjustment,
  useAdjustTarget,
  useResetTargetAdjustment,
  useTargetAdjustmentOffsets,
} from '@gql/server/TargetsHandset';
import { Button } from 'primereact/button';
import { ButtonGroup } from 'primereact/buttongroup';
import { Dropdown } from 'primereact/dropdown';
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

type FocalPlaneOffset = NonNullable<GetTargetAdjustmentOffsetsQuery['targetAdjustmentOffsets']['oiwfs']>;

export default function TargetsHandset({ canEdit }: { canEdit: boolean }) {
  // GraphQL Queries
  const { data: offsets, loading: offsetsLoading } = useTargetAdjustmentOffsets();
  const { data: instrument, loading: instrumentLoading } = useConfiguredInstrument();
  const { data: configurationData, loading: configurationLoading } = useConfiguration();
  const configuration = configurationData?.configuration;

  // GraphQL Mutations
  const [adjustTarget, { loading: adjustTargetLoading }] = useAdjustTarget();
  const [resetOffset, { loading: resetOffsetLoading }] = useResetTargetAdjustment();
  const [absorbOffset, { loading: absorbOffsetLoading }] = useAbsorbTargetAdjustment();
  const [updateInstrument, { loading: updateInstrumentLoading }] = useUpdateInstrument();

  const loading =
    offsetsLoading ||
    adjustTargetLoading ||
    resetOffsetLoading ||
    absorbOffsetLoading ||
    instrumentLoading ||
    updateInstrumentLoading ||
    configurationLoading;

  const targetOptions = targetOptionsBase
    .filter((option) => option.show(configuration))
    .map((option) => ({ label: option.label, value: option.value }));

  // State
  const [selectedTarget, setSelectedTarget] = useState(targetOptions[0]?.value);

  if (!selectedTarget && targetOptions.length > 0) {
    setSelectedTarget(targetOptions[0]!.value);
  }

  const defaultAlignment = 'AC';
  const [strategy, setStrategy] = useState<HandsetStrategy>(strategies[defaultAlignment]);

  let offset: FocalPlaneOffset | undefined;
  switch (selectedTarget) {
    case 'OIWFS':
      offset = offsets?.oiwfs ?? undefined;
      break;
    case 'PWFS1':
      offset = offsets?.pwfs1 ?? undefined;
      break;
    case 'PWFS2':
      offset = offsets?.pwfs2 ?? undefined;
      break;
    case 'SOURCE_A':
      offset = offsets?.sourceA ?? undefined;
      break;
    default:
      if (!loading) console.warn('Unknown target selected:', selectedTarget);
  }

  const [openLoops, setOpenLoops] = useState(true);

  const alignAngleEnabled = strategy.name === 'OIWFS';

  const handleApply = (coords: Coords) =>
    adjustTarget({
      variables: {
        target: selectedTarget!,
        offset: strategy.toInput(
          coords,
          when(alignAngleEnabled, () => instrument?.alignAngle),
        ),
        openLoops,
      },
    });

  return (
    <div className="handset">
      <div className="selector-group">
        <TargetSelector
          loading={loading}
          value={selectedTarget}
          options={targetOptions}
          onChange={setSelectedTarget}
          canEdit={canEdit}
        />
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
            onClick={() => resetOffset({ variables: { openLoops, target: selectedTarget! } })}
          />
          <Button
            size="small"
            label="Absorb"
            disabled={loading || !canEdit}
            onClick={() => absorbOffset({ variables: { target: selectedTarget! } })}
          />
        </ButtonGroup>
      </div>

      <Autoadjust />
    </div>
  );
}

const targetOptionsBase: {
  label: string;
  value: AdjustTarget;
  show: (c: ConfigurationItemFragment | undefined | null) => boolean;
}[] = [
  { value: 'OIWFS', label: 'OIWFS', show: (c) => isNotNullish(c?.selectedOiTarget) },
  { value: 'PWFS1', label: 'PWFS1', show: (c) => isNotNullish(c?.selectedP1Target) },
  { value: 'PWFS2', label: 'PWFS2', show: (c) => isNotNullish(c?.selectedP2Target) },
  { value: 'SOURCE_A', label: 'Base', show: (c) => isNotNullish(c?.selectedTarget) },
];

function TargetSelector({
  value,
  options,
  onChange,
  loading,
  canEdit,
}: {
  value: AdjustTarget | undefined;
  options: { label: string; value: AdjustTarget }[];
  onChange: (value: AdjustTarget) => void;
  loading: boolean;
  canEdit: boolean;
}) {
  return (
    <>
      <label htmlFor="handsets-target">Target</label>
      <Dropdown
        inputId="handsets-target"
        disabled={loading || !canEdit}
        value={value}
        onChange={(e) => onChange(e.value as AdjustTarget)}
        options={options}
        placeholder="Select target"
      />
    </>
  );
}
