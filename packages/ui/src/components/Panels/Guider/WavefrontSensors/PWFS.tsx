import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import type { PwfsFieldStop, PwfsFilter } from '@gql/server/gen/graphql';
import type { PwfsFieldStopResult, PwfsFilterResult, PwfsMechsStateResult } from '@gql/server/MechsState';
import {
  usePwfs1FieldStop,
  usePwfs1Filter,
  usePwfs1MechsState,
  usePwfs2FieldStop,
  usePwfs2Filter,
  usePwfs2MechsState,
} from '@gql/server/MechsState';
import { Dropdown } from 'primereact/dropdown';

import { useMovingLabel } from './hooks';

const filterOptions: { value: PwfsFilter; label: string }[] = [
  { value: 'NEUTRAL', label: 'neutral' },
  { value: 'BLUE', label: 'Blue' },
  { value: 'GREEN', label: 'Green' },
  { value: 'RED', label: 'Red' },
  { value: 'RED04', label: 'Red04' },
  { value: 'RED1', label: 'Red1' },
];

const fieldStopOptions: { value: PwfsFieldStop; label: string }[] = [
  { value: 'PRISM', label: 'prism' },
  { value: 'FS10', label: '10.0' },
  { value: 'FS6_4', label: '6.4' },
  { value: 'FS3_2', label: '3.2' },
  { value: 'FS1_6', label: '1.6' },
  { value: 'OPEN1', label: 'open1' },
  { value: 'OPEN2', label: 'open2' },
  { value: 'OPEN3', label: 'open3' },
  { value: 'OPEN4', label: 'open4' },
];

function PWFS({
  disabled,
  mechsStateResult,
  filterResult,
  fieldStopResult,
}: {
  disabled: boolean;
  mechsStateResult: PwfsMechsStateResult;
  filterResult: PwfsFilterResult;
  fieldStopResult: PwfsFieldStopResult;
}) {
  const { data, loading: mechsStateLoading } = mechsStateResult;

  const [setFilter, { loading: filterLoading }] = filterResult;
  const [setFieldStop, { loading: fieldStopLoading }] = fieldStopResult;

  const loading = mechsStateLoading || filterLoading || fieldStopLoading;

  const [filterMovingLabel, setRequestedFilter] = useMovingLabel(mechsStateLoading, data?.filter, filterOptions);
  const [fieldStopMovingLabel, setRequestedFieldStop] = useMovingLabel(
    mechsStateLoading,
    data?.fieldStop,
    fieldStopOptions,
  );

  return (
    <div className="pwfs">
      <label htmlFor="pwfs-filter" className="label">
        Filter
      </label>
      <Dropdown
        inputId="pwfs-filter"
        disabled={disabled || isNotNullish(filterMovingLabel)}
        loading={loading}
        value={filterMovingLabel ?? data?.filter ?? null}
        options={filterMovingLabel ? [filterMovingLabel] : filterOptions}
        onChange={(e) => {
          setRequestedFilter(e.value as PwfsFilter);
          return setFilter({ variables: { filter: e.value as PwfsFilter } });
        }}
        placeholder="Select filter"
      />

      <label htmlFor="pwfs-field-stop" className="label">
        Field stop
      </label>
      <Dropdown
        inputId="pwfs-field-stop"
        disabled={disabled || isNotNullish(fieldStopMovingLabel)}
        loading={loading}
        value={fieldStopMovingLabel ?? data?.fieldStop ?? null}
        options={fieldStopMovingLabel ? [fieldStopMovingLabel] : fieldStopOptions}
        onChange={(e) => {
          setRequestedFieldStop(e.value as PwfsFieldStop);
          return setFieldStop({ variables: { fieldStop: e.value as PwfsFieldStop } });
        }}
        placeholder="Select stop"
      />
    </div>
  );
}

export function PWFS1({ disabled }: { disabled: boolean }) {
  const mechsStateResult = usePwfs1MechsState();
  const filterResult = usePwfs1Filter();
  const fieldStopResult = usePwfs1FieldStop();
  return (
    <PWFS
      disabled={disabled}
      mechsStateResult={mechsStateResult}
      filterResult={filterResult}
      fieldStopResult={fieldStopResult}
    />
  );
}

export function PWFS2({ disabled }: { disabled: boolean }) {
  const mechsStateResult = usePwfs2MechsState();
  const filterResult = usePwfs2Filter();
  const fieldStopResult = usePwfs2FieldStop();
  return (
    <PWFS
      disabled={disabled}
      mechsStateResult={mechsStateResult}
      filterResult={filterResult}
      fieldStopResult={fieldStopResult}
    />
  );
}
