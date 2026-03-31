import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useRotator, useUpdateRotator } from '@gql/configs/Rotator';
import { Title } from '@Shared/Title/Title';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';

import type { TrackingType } from '@/types';

export function Rotator({ canEdit }: { canEdit: boolean }) {
  const { data: rotatorData, loading: rotatorLoading } = useRotator();
  const rotator = rotatorData?.rotator;
  const [updateRotator, { loading: updateLoading }] = useUpdateRotator();

  const loading = rotatorLoading || updateLoading;

  return (
    <div className="rotator">
      <Title title="Rotator" />
      <div className="body">
        <label htmlFor="rotator-mode" className="label">
          Mode
        </label>
        <Dropdown
          inputId="rotator-mode"
          disabled={!canEdit}
          value={rotator?.tracking ?? null}
          options={['TRACKING', 'FIXED'] satisfies TrackingType[]}
          loading={loading}
          onChange={async (e) => {
            const tracking = e.value as TrackingType;
            if (isNotNullish(rotator?.pk)) await updateRotator({ variables: { pk: rotator.pk, tracking } });
          }}
          placeholder="Select a tracking"
        />
        <label htmlFor="rotator-pa" className="label">
          Position Angle
        </label>
        <InputNumber
          inputId="rotator-pa"
          disabled={!canEdit || loading}
          value={rotator?.angle ?? null}
          minFractionDigits={2}
          maxFractionDigits={3}
          onValueChange={async (e) => {
            const angle = e.target.value!;
            if (isNotNullish(rotator?.pk)) await updateRotator({ variables: { pk: rotator.pk, angle } });
          }}
          mode="decimal"
        />
      </div>
    </div>
  );
}
