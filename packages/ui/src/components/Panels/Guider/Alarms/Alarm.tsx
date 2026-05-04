import { cn, isNotNullish, round } from '@gemini-hlsw/lucuma-common-ui';
import type { GuideAlarm, UpdateGuideAlarmMutationVariables, WfsType } from '@gql/configs/gen/graphql';
import type { GuideQuality } from '@gql/server/gen/graphql';
import { Title } from '@Shared/Title/Title';
import type { InputNumberValueChangeEvent } from 'primereact/inputnumber';
import { InputNumber } from 'primereact/inputnumber';
import type { ToggleButtonChangeEvent } from 'primereact/togglebutton';
import { ToggleButton } from 'primereact/togglebutton';
import { useId } from 'react';

import type { AlarmType } from '@/components/atoms/alarm';
import { Volume, VolumeSlash } from '@/components/Icons';

export function Alarm({
  wfs,
  disabled,
  guideQuality,
  alarm,
  onUpdateAlarm,
  alarmState,
}: {
  wfs: WfsType;
  disabled: boolean;
  guideQuality: GuideQuality | undefined;
  alarm: GuideAlarm | undefined;
  onUpdateAlarm: (alarm: UpdateGuideAlarmMutationVariables) => void;
  alarmState: AlarmType | undefined;
}) {
  const id = useId();

  const limit = alarm?.limit;
  const enabled = alarm?.enabled ?? true;

  const onLimitChange = (e: InputNumberValueChangeEvent) => {
    if (isNotNullish(e.value)) onUpdateAlarm({ wfs, limit: e.value });
  };

  const onEnabledChange = (e: ToggleButtonChangeEvent) => {
    if (isNotNullish(e.value)) onUpdateAlarm({ wfs, enabled: e.value });
  };

  const disabledOrNoData = disabled || !guideQuality || !alarm;

  return (
    <div
      data-testid={alarmState ? 'has-alarm' : 'no-alarm'}
      className={cn('alarm', alarmState && 'has-alarm animate-error-bg')}
    >
      <div className="title-bar">
        <Title title={wfs} />
        <ToggleButton
          onLabel=""
          offLabel=""
          onIcon={<Volume />}
          offIcon={<VolumeSlash />}
          disabled={disabledOrNoData}
          checked={enabled}
          onChange={onEnabledChange}
          aria-label="Enable alarm"
        />
      </div>
      <div className="body">
        <label htmlFor={`flux-${id}`} className="label">
          Counts
        </label>
        <output id={`flux-${id}`}>{isNotNullish(guideQuality?.flux) ? round(guideQuality.flux, 0) : ''}</output>
        <label htmlFor={`limit-${id}`} className="label">
          Limit
        </label>
        <InputNumber
          inputId={`limit-${id}`}
          min={0}
          disabled={disabledOrNoData}
          value={limit}
          maxFractionDigits={0}
          onValueChange={onLimitChange}
          data-testid={`limit-${wfs}`}
        />
        <label htmlFor={`centroid-${id}`} className="label">
          Subaperture
        </label>
        <output id={`centroid-${id}`}>{guideQuality?.centroidDetected ? 'OK' : 'BAD'}</output>
      </div>
    </div>
  );
}
