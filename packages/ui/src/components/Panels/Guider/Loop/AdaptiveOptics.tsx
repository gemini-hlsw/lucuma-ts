import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useAltairGuideLoop, useUpdateAltairGuideLoop } from '@gql/configs/AltairGuideLoop';
import { useGetGemsGuideLoop, useUpdateGemsGuideLoop } from '@gql/configs/GemsGuideLoop';
import type {
  UpdateAltairGuideLoopMutationVariables,
  UpdateGemsGuideLoopMutationVariables,
} from '@gql/configs/gen/graphql';
import { Title } from '@Shared/Title/Title';
import { Checkbox } from 'primereact/checkbox';

import { useCanEdit } from '@/components/atoms/auth';

export function Altair() {
  const canEdit = useCanEdit();
  const { data, loading } = useAltairGuideLoop();
  const state = data?.altairGuideLoop;
  const [updateAltairGuideLoop, { loading: updateLoading }] = useUpdateAltairGuideLoop();

  async function modifyAltairGuideLoop<T extends keyof UpdateAltairGuideLoopMutationVariables>(
    name: T,
    value: NonNullable<UpdateAltairGuideLoopMutationVariables[T]>,
  ) {
    if (isNotNullish(state?.pk)) await updateAltairGuideLoop({ variables: { pk: state.pk, [name]: value } });
  }

  const disabled = !canEdit || loading || updateLoading;

  return (
    <div className="adaptive-optics">
      <Title title="Altair" />
      <div className="ao-body">
        <label htmlFor="aoEnabled" className="label">
          AO enabled
        </label>
        <Checkbox
          inputId="aoEnabled"
          disabled={disabled}
          checked={!!state?.aoEnabled}
          onChange={() => modifyAltairGuideLoop('aoEnabled', !state?.aoEnabled)}
        />
        <label htmlFor="oiBlend" className="label">
          OI blend
        </label>
        <Checkbox
          inputId="oiBlend"
          disabled={disabled}
          checked={!!state?.oiBlend}
          onChange={() => modifyAltairGuideLoop('oiBlend', !state?.oiBlend)}
        />
        <label htmlFor="focus" className="label">
          Focus
        </label>
        <Checkbox
          inputId="focus"
          disabled={disabled}
          checked={!!state?.focus}
          onChange={() => modifyAltairGuideLoop('focus', !state?.focus)}
        />
        <label htmlFor="p1Ttf" className="label">
          P1 TTF
        </label>
        <Checkbox
          inputId="p1Ttf"
          disabled={disabled}
          checked={!!state?.p1Ttf}
          onChange={() => modifyAltairGuideLoop('p1Ttf', !state?.p1Ttf)}
        />
        <label htmlFor="strap" className="label">
          STRAP
        </label>
        <Checkbox
          inputId="strap"
          disabled={disabled}
          checked={!!state?.strap}
          onChange={() => modifyAltairGuideLoop('strap', !state?.strap)}
        />
        <label htmlFor="oiTtf" className="label">
          OI TTF
        </label>
        <Checkbox
          inputId="oiTtf"
          disabled={disabled}
          checked={!!state?.oiTtf}
          onChange={() => modifyAltairGuideLoop('oiTtf', !state?.oiTtf)}
        />
        <label htmlFor="ttgs" className="label">
          TTGS
        </label>
        <Checkbox
          inputId="ttgs"
          disabled={disabled}
          checked={!!state?.ttgs}
          onChange={() => modifyAltairGuideLoop('ttgs', !state?.ttgs)}
        />
        <label htmlFor="sfo" className="label">
          SFO
        </label>
        <Checkbox
          inputId="sfo"
          disabled={disabled}
          checked={!!state?.sfo}
          onChange={() => modifyAltairGuideLoop('sfo', !state?.sfo)}
        />
      </div>
    </div>
  );
}

export function GeMS() {
  const canEdit = useCanEdit();
  const { data, loading: getLoading } = useGetGemsGuideLoop();
  const state = data?.gemsGuideLoop;
  const [updateGemsGuideLoop, { loading: updateLoading }] = useUpdateGemsGuideLoop();

  async function modifyGemsGuideLoop<T extends keyof UpdateGemsGuideLoopMutationVariables>(
    name: T,
    value: NonNullable<UpdateGemsGuideLoopMutationVariables[T]>,
  ) {
    if (isNotNullish(state?.pk)) await updateGemsGuideLoop({ variables: { pk: state.pk, [name]: value } });
  }

  const disabled = !canEdit || getLoading || updateLoading;

  return (
    <div className="adaptive-optics">
      <Title title="GeMS" />
      <div className="ao-body">
        <label htmlFor="aoEnabled" className="label">
          AO enabled
        </label>
        <Checkbox
          inputId="aoEnabled"
          disabled={disabled}
          checked={!!state?.aoEnabled}
          onChange={() => modifyGemsGuideLoop('aoEnabled', !state?.aoEnabled)}
        />
        <label htmlFor="focus" className="label">
          Focus
        </label>
        <Checkbox
          inputId="focus"
          disabled={disabled}
          checked={!!state?.focus}
          onChange={() => modifyGemsGuideLoop('focus', !state?.focus)}
        />
        <label htmlFor="rotation" className="label">
          Rotation
        </label>
        <Checkbox
          inputId="rotation"
          disabled={disabled}
          checked={!!state?.rotation}
          onChange={() => modifyGemsGuideLoop('rotation', !state?.rotation)}
        />
        <label htmlFor="tipTilt" className="label">
          Tip/Tilt
        </label>
        <Checkbox
          inputId="tipTilt"
          disabled={disabled}
          checked={!!state?.tipTilt}
          onChange={() => modifyGemsGuideLoop('tipTilt', !state?.tipTilt)}
        />
        <label htmlFor="anisopl" className="label">
          Anisopl.
        </label>
        <Checkbox
          inputId="anisopl"
          disabled={disabled}
          checked={!!state?.anisopl}
          onChange={() => modifyGemsGuideLoop('anisopl', !state?.anisopl)}
        />
        <label htmlFor="flexure" className="label">
          Flexure
        </label>
        <Checkbox
          inputId="flexure"
          disabled={disabled}
          checked={!!state?.flexure}
          onChange={() => modifyGemsGuideLoop('flexure', !state?.flexure)}
        />
      </div>
    </div>
  );
}
