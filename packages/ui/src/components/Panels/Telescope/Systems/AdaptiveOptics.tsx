import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useAltairInstrument, useUpdateAltairInstrument } from '@gql/configs/AltairInstrument';
import { useGemsInstrument, useUpdateGemsInstrument } from '@gql/configs/GemsInstrument';
import type {
  UpdateAltairInstrumentMutationVariables,
  UpdateGemsInstrumentMutationVariables,
} from '@gql/configs/gen/graphql';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';

import type { AltairInstrumentType, GemsInstrumentType } from '@/types';

import { Title } from '../../../Shared/Title/Title';

export function GeMS({ canEdit }: { canEdit: boolean }) {
  const state = useGemsInstrument().data?.gemsInstrument ?? ({} as GemsInstrumentType);
  const [updateGemsInstrument, { loading }] = useUpdateGemsInstrument();

  async function modifyGemsInstrument<T extends keyof UpdateGemsInstrumentMutationVariables>(
    name: T,
    value: NonNullable<UpdateGemsInstrumentMutationVariables[T]>,
  ) {
    if (isNotNullish(state.pk)) await updateGemsInstrument({ variables: { pk: state.pk, [name]: value } });
  }

  return (
    <div className="ao-gems under-construction">
      <Title title="GeMS" />
      <div className="body">
        <label htmlFor="adc" className="label">
          ADC
        </label>
        <Checkbox
          inputId="adc"
          disabled={!canEdit || loading}
          checked={state.adc}
          onChange={() => modifyGemsInstrument('adc', !state.adc)}
        />
        <label htmlFor="beamsplitter" className="label">
          Beamsplitter
        </label>
        <Dropdown
          inputId="beamsplitter"
          disabled={!canEdit}
          loading={loading}
          value={state.beamsplitter}
          options={['400 nm', '550 nm', '700nm', '850 nm', '1000 nm']}
          onChange={(e) => modifyGemsInstrument('beamsplitter', e.value as string)}
          placeholder="Select a beamsplitter"
        />
        <label htmlFor="asometric-mode" className="label">
          Astrometric mode
        </label>
        <Dropdown
          inputId="asometric-mode"
          disabled={!canEdit}
          loading={loading}
          value={state.astrometricMode}
          options={['Best', 'Average']}
          onChange={(e) => modifyGemsInstrument('astrometricMode', e.value as string)}
          placeholder="Select a mode"
        />
      </div>
    </div>
  );
}

export function Altair({ canEdit }: { canEdit: boolean }) {
  const state = useAltairInstrument().data?.altairInstrument ?? ({} as AltairInstrumentType);
  const [updateAltairInstrument, { loading }] = useUpdateAltairInstrument();

  async function modifyAltairInstrument<T extends keyof UpdateAltairInstrumentMutationVariables>(
    name: T,
    value: UpdateAltairInstrumentMutationVariables[T],
  ) {
    if (isNotNullish(value) && isNotNullish(state.pk))
      await updateAltairInstrument({ variables: { pk: state.pk, [name]: value } });
  }

  return (
    <div className="ao-altair under-construction">
      <Title title="Altair" />
      <div className="body">
        <label htmlFor="beamsplitter" className="label">
          Beamsplitter
        </label>
        <Dropdown
          inputId="beamsplitter"
          loading={loading}
          disabled={!canEdit}
          value={state.beamsplitter}
          options={['400 nm', '550 nm', '700nm', '850 nm', '1000 nm']}
          onChange={(e) => modifyAltairInstrument('beamsplitter', e.value as string)}
          placeholder="Select a tracking"
        />
        <label htmlFor="nd-filter" className="label">
          ND filter
        </label>
        <Checkbox
          inputId="nd-filter"
          disabled={!canEdit || loading}
          checked={state.ndFilter}
          onChange={() => modifyAltairInstrument('ndFilter', !state.ndFilter)}
        />
        <label htmlFor="star-mag" className="label">
          Star Mag
        </label>
        <InputNumber
          inputId="star-mag"
          disabled={!canEdit || loading}
          value={state.startMagnitude}
          onValueChange={(e) => modifyAltairInstrument('startMagnitude', e.target.value ?? 0.0)}
        />
        <label htmlFor="field-lens" className="label">
          Field Lens
        </label>
        <Checkbox
          inputId="field-lens"
          disabled={!canEdit || loading}
          checked={state.fieldLens}
          onChange={() => modifyAltairInstrument('fieldLens', !state.fieldLens)}
        />
        <label htmlFor="seeing" className="label">
          Seeing r0
        </label>
        <InputNumber
          inputId="seeing"
          disabled={!canEdit || loading}
          value={state.seeing}
          onValueChange={(e) => modifyAltairInstrument('seeing', e.target.value ?? 0.0)}
        />
        <label htmlFor="deploy-adc" className="label">
          Deploy ADC
        </label>
        <Checkbox
          inputId="deploy-adc"
          disabled={!canEdit || loading}
          checked={state.deployAdc}
          onChange={() => modifyAltairInstrument('deployAdc', !state.deployAdc)}
        />
        <label htmlFor="wind-speed" className="label">
          Wind speed
        </label>
        <InputNumber
          inputId="wind-speed"
          disabled={!canEdit || loading}
          value={state.windSpeed}
          onValueChange={(e) => modifyAltairInstrument('windSpeed', e.target.value ?? 0.0)}
        />
        <label htmlFor="adjust-adc" className="label">
          Adjust ADC
        </label>
        <Checkbox
          inputId="adjust-adc"
          disabled={!canEdit || loading}
          checked={state.adjustAdc}
          onChange={() => modifyAltairInstrument('adjustAdc', !state.adjustAdc)}
        />
        <label htmlFor="force-mode" className="label">
          Force Mode
        </label>
        <Checkbox
          inputId="force-mode"
          disabled={!canEdit || loading}
          checked={state.forceMode}
          onChange={() => modifyAltairInstrument('forceMode', !state.forceMode)}
        />
        <label htmlFor="lgs" className="label">
          Use LGS
        </label>
        <Checkbox
          inputId="lgs"
          disabled={!canEdit}
          checked={state.lgs}
          onChange={() => modifyAltairInstrument('lgs', !state.lgs)}
        />
      </div>
    </div>
  );
}
