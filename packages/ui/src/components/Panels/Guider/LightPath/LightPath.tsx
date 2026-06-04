import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguration } from '@gql/configs/Configuration';
import type { UpdateGuideLoopMutationVariables } from '@gql/configs/gen/graphql';
import { useGetGuideLoop, useUpdateGuideLoop } from '@gql/configs/GuideLoop';
import type {
  Instrument,
  LightpathConfigMutationVariables,
  LightSinkVariant,
  LightSource,
  Site,
} from '@gql/server/gen/graphql';
import { useLightpathConfig } from '@gql/server/Lightpath';
import { Title } from '@Shared/Title/Title';
import { createLightSinkVariant } from '@Telescope/Targets/inputs';
import { Button } from 'primereact/button';

import { useCanEdit } from '@/components/atoms/auth';
import { useServerConfigValue } from '@/components/atoms/config';
import { Check } from '@/components/Icons';
import type { Fpu, GuideLoop } from '@/types';

interface LightPathConfiguration extends LightpathConfigMutationVariables {
  label: string;
}

/**
 * | UI Option               | LightSource | LightSink    |
 * | ----------------------- | ----------- | ------------ |
 * | Sky -> Instrument       | Sky         | <instrument> |
 * | Sky -> AO -> Instrument | AO          | <instrument> |
 * | Sky -> AC               | Sky         | ACQ_CAM      |
 * | Sky -> AO -> AC         | AO          | ACQ_CAM      |
 * | GCAL -> Instrument      | GCAL        | <instrument> |
 *
 */
function lightPathConfigForInstrument(
  instrument: Instrument | null | undefined,
  site: Site,
  fpu: Fpu | null | undefined,
): LightPathConfiguration[] {
  const lightSinkVariant = createLightSinkVariant(instrument, fpu);
  const acqCam: Instrument = site === 'GN' ? 'ACQ_CAM_NORTH' : 'ACQ_CAM_SOUTH';

  return [
    { label: 'Sky → Instrument', from: 'SKY', instrument: instrument!, lightSinkVariant },
    { label: 'Sky → AO → Instrument', from: 'AO', instrument: instrument!, lightSinkVariant },
    { label: 'Sky → AC', from: 'SKY', instrument: acqCam, lightSinkVariant: createLightSinkVariant(acqCam, fpu) },
    { label: 'Sky → AO → AC', from: 'AO', instrument: acqCam, lightSinkVariant: createLightSinkVariant(acqCam, fpu) },
    { label: 'GCAL → Instrument', from: 'GCAL', instrument: instrument!, lightSinkVariant },
  ];
}

export function LightPath() {
  const canEdit = useCanEdit();

  const { data, loading: getLoading } = useGetGuideLoop();
  const [updateGuideLoop, { loading: updateLoading }] = useUpdateGuideLoop();
  const state = data?.guideLoop ?? ({} as Partial<GuideLoop>);
  const lightPath = state.lightPath;
  const { data: configurationData, loading: instrumentLoading } = useConfiguration();
  const instrument = configurationData?.configuration?.obsInstrument;
  const fpu = configurationData?.configuration?.fpu;
  const { site } = useServerConfigValue();

  const [updateLightpathConfig, { loading: lightpathConfigLoading }] = useLightpathConfig();

  async function modifyGuideLoop<T extends keyof UpdateGuideLoopMutationVariables>(
    name: T,
    value: UpdateGuideLoopMutationVariables[T],
  ) {
    if (isNotNullish(state.pk)) await updateGuideLoop({ variables: { pk: state.pk, [name]: value } });
  }
  const disabled = !canEdit;
  const loading = getLoading || updateLoading || lightpathConfigLoading || instrumentLoading;

  async function onClick(
    newLightPath: string,
    from: LightSource | null | undefined,
    instrument: Instrument,
    lightSinkVariant: LightSinkVariant | null | undefined,
  ) {
    await Promise.all([
      modifyGuideLoop('lightPath', newLightPath),
      updateLightpathConfig({ variables: { from, instrument, lightSinkVariant } }),
    ]);
  }

  const lightPathConfigurations = lightPathConfigForInstrument(instrument, site, fpu);

  return (
    <div className="light-path">
      <Title title="Light path" />
      <div className="body">
        {lightPathConfigurations.map(({ label, from, instrument, lightSinkVariant }) => {
          return (
            <Button
              icon={label === lightPath && <Check size="lg" />}
              key={label}
              loading={loading}
              disabled={disabled}
              label={label}
              onClick={() => onClick(label, from, instrument, lightSinkVariant)}
            />
          );
        })}
      </div>
    </div>
  );
}
