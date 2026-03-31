import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import type { GuideLoop, UpdateGuideLoopMutationVariables } from '@gql/configs/gen/graphql';
import { useGetGuideLoop, useUpdateGuideLoop } from '@gql/configs/GuideLoop';
import type { LightSink, LightSource } from '@gql/server/gen/graphql';
import { useLightpathConfig } from '@gql/server/Lightpath';
import { Title } from '@Shared/Title/Title';
import { Button } from 'primereact/button';

import { useCanEdit } from '@/components/atoms/auth';
import { Check } from '@/components/Icons';

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
const options: { label: string; from: LightSource; to: LightSink }[] = [
  { label: 'Sky → Instrument', from: 'SKY', to: 'GMOS' },
  { label: 'Sky → AO → Instrument', from: 'AO', to: 'GMOS' },
  { label: 'Sky → AC', from: 'SKY', to: 'AC' },
  { label: 'Sky → AO → AC', from: 'AO', to: 'AC' },
  { label: 'GCAL → Instrument', from: 'GCAL', to: 'GMOS' },
];

export function LightPath() {
  const canEdit = useCanEdit();

  const { data, loading: getLoading } = useGetGuideLoop();
  const [updateGuideLoop, { loading: updateLoading }] = useUpdateGuideLoop();
  const state = data?.guideLoop ?? ({} as Partial<GuideLoop>);
  const lightPath = state.lightPath;

  const [updateLightpathConfig, { loading: lightpathConfigLoading }] = useLightpathConfig();

  async function modifyGuideLoop<T extends keyof UpdateGuideLoopMutationVariables>(
    name: T,
    value: UpdateGuideLoopMutationVariables[T],
  ) {
    if (isNotNullish(state.pk)) await updateGuideLoop({ variables: { pk: state.pk, [name]: value } });
  }
  const disabled = !canEdit;
  const loading = getLoading || updateLoading || lightpathConfigLoading;

  async function onClick(newLightPath: string, from: LightSource, to: LightSink) {
    await Promise.all([
      modifyGuideLoop('lightPath', newLightPath),
      updateLightpathConfig({
        variables: { from, to },
      }),
    ]);
  }

  return (
    <div className="light-path">
      <Title title="Light path" />
      <div className="body">
        {options.map(({ label, from, to }) => {
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
