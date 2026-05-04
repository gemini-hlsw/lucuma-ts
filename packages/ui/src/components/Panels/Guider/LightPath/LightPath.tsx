import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguration } from '@gql/configs/Configuration';
import type { GuideLoopItemFragment, UpdateGuideLoopMutationVariables } from '@gql/configs/gen/graphql';
import { useGetGuideLoop, useUpdateGuideLoop } from '@gql/configs/GuideLoop';
import type { Instrument, LightSink, LightSource } from '@gql/server/gen/graphql';
import { useLightpathConfig } from '@gql/server/Lightpath';
import { Title } from '@Shared/Title/Title';
import { Button } from 'primereact/button';
import type { ToastMessage } from 'primereact/toast';
import { useEffect } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { Check } from '@/components/Icons';
import { useToast } from '@/Helpers/toast';

interface LightPathConfiguration {
  label: string;
  from: LightSource;
  to: LightSink;
}

/**
 * | UI Option               | LightSource | LightSink |
 * | ----------------------- | ----------- | --------- |
 * | Sky -> Instrument       | Sky         | GMOS      |
 * | Sky -> AO -> Instrument | AO          | GMOS      |
 * | Sky -> AC               | Sky         | AC        |
 * | Sky -> AO -> AC         | AO          | AC        |
 * | GCAL -> Instrument      | GCAL        | GMOS      |
 *
 */
function lightPathConfigForInstrument(instrument: Instrument | null | undefined): LightPathConfiguration[] {
  const toSink = instrument ? lightSinkForInstrument(instrument) : 'GMOS';
  return [
    { label: 'Sky → Instrument', from: 'SKY', to: toSink },
    { label: 'Sky → AO → Instrument', from: 'AO', to: toSink },
    { label: 'Sky → AC', from: 'SKY', to: 'AC' },
    { label: 'Sky → AO → AC', from: 'AO', to: 'AC' },
    { label: 'GCAL → Instrument', from: 'GCAL', to: toSink },
  ];
}

export function LightPath() {
  const canEdit = useCanEdit();

  const { data, loading: getLoading } = useGetGuideLoop();
  const [updateGuideLoop, { loading: updateLoading }] = useUpdateGuideLoop();
  const state = data?.guideLoop ?? ({} as Partial<GuideLoopItemFragment>);
  const lightPath = state.lightPath;
  const { data: configurationData, loading: instrumentLoading } = useConfiguration();
  const instrument = configurationData?.configuration?.obsInstrument;

  const [updateLightpathConfig, { loading: lightpathConfigLoading }] = useLightpathConfig();

  async function modifyGuideLoop<T extends keyof UpdateGuideLoopMutationVariables>(
    name: T,
    value: UpdateGuideLoopMutationVariables[T],
  ) {
    if (isNotNullish(state.pk)) await updateGuideLoop({ variables: { pk: state.pk, [name]: value } });
  }
  const disabled = !canEdit;
  const loading = getLoading || updateLoading || lightpathConfigLoading || instrumentLoading;

  async function onClick(newLightPath: string, from: LightSource, to: LightSink) {
    await Promise.all([
      modifyGuideLoop('lightPath', newLightPath),
      updateLightpathConfig({
        variables: { from, to },
      }),
    ]);
  }

  const toast = useToast();

  let lightPathConfigurations: LightPathConfiguration[];
  try {
    lightPathConfigurations = lightPathConfigForInstrument(instrument);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    lightPathConfigurations = lightPathConfigForInstrument('GMOS_NORTH');
  }

  useEffect(() => {
    try {
      if (instrument) lightSinkForInstrument(instrument);
      return;
    } catch (e) {
      const toastMessage: ToastMessage = {
        severity: 'error',
        summary: 'Error configuring light path',
        detail: (e as Error).message,
        life: 10_000,
      };
      toast?.show(toastMessage);
      return () => toast?.remove(toastMessage);
    }
  }, [instrument, toast, lightPath]);

  return (
    <div className="light-path">
      <Title title="Light path" />
      <div className="body">
        {lightPathConfigurations.map(({ label, from, to }) => {
          return (
            <Button
              icon={label === lightPath && <Check size="lg" />}
              key={label}
              loading={loading}
              disabled={disabled}
              label={label}
              onClick={() => onClick(label, from, to)}
            />
          );
        })}
      </div>
    </div>
  );
}

function lightSinkForInstrument(instrument: Instrument): LightSink {
  switch (instrument) {
    case 'ACQ_CAM':
      return 'AC';
    case 'FLAMINGOS2':
      return 'F2';
    case 'GHOST':
      return 'GHOST';
    case 'GMOS_NORTH':
    case 'GMOS_SOUTH':
      return 'GMOS';
    case 'GNIRS':
      return 'GNIRS';
    case 'GPI':
      return 'GPI';
    case 'GSAOI':
      return 'GSAOI';
    case 'IGRINS2':
      return 'IGRINS2';
    case 'NIRI':
      // TODO: which NIRI?
      return 'NIRI_F6';
    case 'VISITOR':
      return 'VISITOR';

    case 'ALOPEKE':
    case 'ZORRO':
      return 'VISITOR';

    case 'SCORPIO':
    default:
      throw new Error(
        `Instrument ${instrument} is not (yet) supported in light path configuration. Contact the developers.`,
      );
  }
}
