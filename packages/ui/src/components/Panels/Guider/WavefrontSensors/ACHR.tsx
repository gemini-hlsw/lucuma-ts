import { isNotNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { useCalParams } from '@gql/configs/CalParams';
import type { AcFilter, AcLens, AcNdFilter, AcWindowSize } from '@gql/server/gen/graphql';
import { useAcFilter, useAcLens, useAcMechsState, useAcNdFilter, useAcWindowSize } from '@gql/server/MechsState';
import { Dropdown } from 'primereact/dropdown';
import { useState } from 'react';

import { useServerConfigValue } from '@/components/atoms/config';

import { useMovingLabel } from './hooks';

const lensOptions: { value: AcLens; label: string }[] = [
  { value: 'AC', label: 'AC' },
  { value: 'HRWFS', label: 'HRWFS' },
];
const filterOptions: { value: AcFilter; label: string }[] = [
  { value: 'NEUTRAL', label: 'neutral' },
  { value: 'B_BLUE', label: 'B-blue' },
  { value: 'V_GREEN', label: 'V-green' },
  { value: 'U_RED1', label: 'U-red1' },
  { value: 'R_RED2', label: 'R-red2' },
  { value: 'I_RED3', label: 'I-red3' },
];

const gsNdFilterOptions: { value: AcNdFilter; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ND1', label: 'ND1' },
  { value: 'ND2', label: 'ND2' },
  { value: 'ND3', label: 'ND3' },
];

const gnNdFilterOptions: { value: AcNdFilter; label: string }[] = [
  { value: 'OPEN', label: 'open' },

  { value: 'ND100', label: 'nd100' },
  { value: 'ND1000', label: 'nd1000' },
  { value: 'FILT04', label: 'filt04' },
  { value: 'FILT06', label: 'filt06' },
  { value: 'FILT08', label: 'filt08' },
];
const windowSizeOptions: { value: AcWindowSize; label: string }[] = [
  { value: 'WINDOW_100X100', label: '100x100' },
  { value: 'WINDOW_200X200', label: '200x200' },
  { value: 'FULL', label: 'Full' },
];

export function ACHR({ disabled }: { disabled: boolean }) {
  const { site } = useServerConfigValue();

  const { data: mechsState, loading: mechsStateLoading } = useAcMechsState();
  const { data: calParamsData, loading: calParamsLoading } = useCalParams(site);
  const calParams = calParamsData?.calParams;

  const [setLens, { loading: lensLoading }] = useAcLens();
  const [setFilter, { loading: filterLoading }] = useAcFilter();
  const [setNdFilter, { loading: ndFilterLoading }] = useAcNdFilter();
  const [setWindowSize, { loading: windowSizeLoading }] = useAcWindowSize();

  const loading =
    mechsStateLoading || calParamsLoading || lensLoading || ndFilterLoading || filterLoading || windowSizeLoading;

  const ndFilterOptions = site === 'GN' ? gnNdFilterOptions : gsNdFilterOptions;

  const [auxWindowSize, setAuxWindowSize] = useState<AcWindowSize | null>(null);

  const [lensMovingLabel, setRequestedLens] = useMovingLabel(mechsStateLoading, mechsState?.lens, lensOptions);
  const [filterMovingLabel, setRequestedFilter] = useMovingLabel(mechsStateLoading, mechsState?.filter, filterOptions);
  const [ndFilterMovingLabel, setRequestedNdFilter] = useMovingLabel(
    mechsStateLoading,
    mechsState?.ndFilter,
    ndFilterOptions,
  );

  return (
    <div className="achr">
      <label htmlFor="achr-lens" className="label">
        Lens
      </label>
      <Dropdown
        loading={loading}
        inputId="achr-lens"
        disabled={disabled || isNotNullish(lensMovingLabel)}
        value={lensMovingLabel ?? mechsState?.lens ?? null}
        options={lensMovingLabel ? [lensMovingLabel] : lensOptions}
        onChange={(e) => {
          setRequestedLens(e.value as AcLens);
          return setLens({ variables: { lens: e.value as AcLens } });
        }}
        placeholder="Select lens pos"
      />

      <label htmlFor="achr-filter" className="label">
        Filter
      </label>
      <Dropdown
        loading={loading}
        inputId="achr-filter"
        disabled={disabled || isNotNullish(filterMovingLabel)}
        value={filterMovingLabel ?? mechsState?.filter ?? null}
        options={filterMovingLabel ? [filterMovingLabel] : filterOptions}
        onChange={(e) => {
          setRequestedFilter(e.value as AcFilter);
          return setFilter({ variables: { filter: e.value as AcFilter } });
        }}
        placeholder="Select filter"
      />

      <label htmlFor="achr-nd" className="label">
        Neutral density
      </label>
      <Dropdown
        loading={loading}
        inputId="achr-nd"
        disabled={disabled || isNotNullish(ndFilterMovingLabel)}
        value={ndFilterMovingLabel ?? mechsState?.ndFilter ?? null}
        options={ndFilterMovingLabel ? [ndFilterMovingLabel] : ndFilterOptions}
        onChange={(e) => {
          setRequestedNdFilter(e.value as AcNdFilter);
          return setNdFilter({ variables: { ndFilter: e.value as AcNdFilter } });
        }}
        placeholder="Select state"
      />

      <label htmlFor="achr-window-size" className="label">
        ROI
      </label>
      <div className="window-size">
        <Dropdown
          loading={loading}
          className="under-construction"
          inputId="achr-window-size"
          disabled={disabled}
          value={auxWindowSize}
          options={windowSizeOptions}
          onChange={(e) => {
            setAuxWindowSize(e.value as AcWindowSize);
            return setWindowSize({
              variables: {
                size: {
                  type: e.value as AcWindowSize,
                  center: when(e.value !== 'FULL', () => ({ x: calParams?.acqCamX, y: calParams?.acqCamY })),
                },
              },
            });
          }}
          placeholder="Select ROI"
        />
      </div>
    </div>
  );
}
