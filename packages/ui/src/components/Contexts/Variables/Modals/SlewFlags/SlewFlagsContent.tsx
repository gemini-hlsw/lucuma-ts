import { isNullish } from '@gemini-hlsw/lucuma-common-ui';
import type { UpdateSlewFlagsMutationVariables } from '@gql/configs/gen/graphql';
import { useSlewFlags, useUpdateSlewFlags } from '@gql/configs/SlewFlags';
import { InputSwitch } from 'primereact/inputswitch';
import { useId } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import type { SlewFlagsType } from '@/types';

export function SlewFlagsContent() {
  const { data, loading } = useSlewFlags();
  const slewFlags = data?.slewFlags ?? ({} as SlewFlagsType);

  return (
    <div className="slew-flags">
      <SlewFlagInput flags={slewFlags} loading={loading} flag="zeroChopThrow" label="Zero Chop Throw" />
      <SlewFlagInput flags={slewFlags} loading={loading} flag="zeroSourceOffset" label="Zero Source Offset" />
      <SlewFlagInput flags={slewFlags} loading={loading} flag="zeroSourceDiffTrack" label="Zero Source Diff Track" />
      <SlewFlagInput flags={slewFlags} loading={loading} flag="zeroMountOffset" label="Zero Mount Offset" />
      <SlewFlagInput flags={slewFlags} loading={loading} flag="zeroMountDiffTrack" label="Zero Mount Diff Track" />
      <SlewFlagInput
        flags={slewFlags}
        loading={loading}
        flag="shortcircuitTargetFilter"
        label="Shortcircuit Target Filter"
      />
      <SlewFlagInput
        flags={slewFlags}
        loading={loading}
        label="Shortcircuit Mount Filter"
        flag="shortcircuitMountFilter"
      />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Reset Local Pointing" flag="resetPointing" />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Stop Guide" flag="stopGuide" />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Zero Guide Offset" flag="zeroGuideOffset" />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Zero Instrument Offset" flag="zeroInstrumentOffset" />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Autopark P1 WFS" flag="autoparkPwfs1" />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Autopark P2 WFS" flag="autoparkPwfs2" />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Autopark OI WFS" flag="autoparkOiwfs" />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Autopark Gems" flag="autoparkGems" />
      <SlewFlagInput flags={slewFlags} loading={loading} label="Autopark AO WFS" flag="autoparkAowfs" />
    </div>
  );
}

function SlewFlagInput({
  flag,
  label,
  flags,
  loading,
}: {
  flag: keyof UpdateSlewFlagsMutationVariables;
  label: string;
  flags: SlewFlagsType;
  loading: boolean;
}) {
  const canEdit = useCanEdit();
  const id = useId();
  const [updateSlewFlags, { loading: updateLoading }] = useUpdateSlewFlags();

  async function updateFlags() {
    await updateSlewFlags({
      variables: { pk: flags.pk, [flag]: !flags[flag] },
    });
  }
  const inputId = `${flag}-${id}`;

  return (
    <>
      <label htmlFor={inputId} style={{ textAlign: 'center', alignSelf: 'center' }}>
        {label}
      </label>
      <InputSwitch
        inputId={inputId}
        disabled={!canEdit || updateLoading || loading || isNullish(flags[flag])}
        checked={Boolean(flags[flag])}
        onChange={updateFlags}
      />
    </>
  );
}
