import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { useObservationsByState } from '@gql/odb/Observation';
import { FilterMatchMode } from 'primereact/api';
import type { ColumnProps as PColumnProps } from 'primereact/column';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { useState } from 'react';

import { useServerConfigValue } from '@/components/atoms/config';
import { Search } from '@/components/Icons';
import type { OdbObservationType } from '@/types';

interface ParamsInterface {
  selectedObservation: OdbObservationType | null;
  setSelectedObservation: (_: OdbObservationType | null) => void;
}

interface ColumnProps extends PColumnProps {
  field: string;
  header: string;
  filterPlaceholder: string;
  visible: boolean;
}

const defaultColumns: ColumnProps[] = [
  {
    field: 'reference.label',
    header: 'Observation Reference',
    filterPlaceholder: 'Filter Observation Reference',
    visible: true,
  },
  { field: 'id', header: 'ID', filterPlaceholder: 'Search ID', visible: true },
  { field: 'title', header: 'Title', filterPlaceholder: 'Search Title', visible: true },
  {
    field: 'program.pi.user.profile.givenName',
    header: 'PI Given Name',
    filterPlaceholder: 'Filter Given Name',
    visible: true,
  },
  {
    field: 'program.pi.user.profile.familyName',
    header: 'PI Family Name',
    filterPlaceholder: 'Filter Family Name',
    visible: true,
  },
  {
    field: 'targetEnvironment.firstScienceTarget.name',
    header: 'Target Name',
    filterPlaceholder: 'Filter Target Name',
    visible: false,
  },
  {
    field: 'targetEnvironment.blindOffsetTarget.name',
    header: 'Blind Offset Target Name',
    filterPlaceholder: 'Filter Blind Offset Target Name',
    visible: false,
  },
  {
    field: 'instrument',
    header: 'Instrument',
    filterPlaceholder: 'Filter Instrument',
    visible: false,
  },
];

interface FilterValue {
  value: string;
  matchMode: FilterMatchMode;
}
type Filters = Record<string, FilterValue>;

export function ObservationTable({ selectedObservation, setSelectedObservation }: ParamsInterface) {
  const { site } = useServerConfigValue();
  const observingNight = dateToLocalObservingNight(new Date());

  const [columns, setColumns] = useState(
    localStorage.getItem('observationTableColumns')
      ? (JSON.parse(localStorage.getItem('observationTableColumns')!) as ColumnProps[])
      : defaultColumns,
  );
  const visibleColumns = columns.filter((c) => c.visible);

  const [filters, setFilters] = useState(() =>
    defaultColumns.reduce<Filters>(
      (acc, c) => {
        acc[c.field] = { value: '', matchMode: FilterMatchMode.CONTAINS };
        return acc;
      },
      { global: { value: '', matchMode: FilterMatchMode.CONTAINS } },
    ),
  );

  const { data, loading } = useObservationsByState({
    variables: {
      date: observingNight,
      site,
      states: ['READY', 'ONGOING'],
    },
  });
  const observations = data?.observations.matches;

  const setGlobalFilterValue = (value: string) =>
    setFilters((prevFilters) => ({
      ...prevFilters,
      global: { ...prevFilters.global!, value },
    }));

  const onMultiSelectChange = (e: { value: ColumnProps[] }) => {
    const newColumns = columns.map((c) => ({ ...c, visible: e.value.some((v) => v.field === c.field) }));
    setColumns(newColumns);
    localStorage.setItem('observationTableColumns', JSON.stringify(newColumns));
  };

  const header = (
    <div className="header-table">
      {selectedObservation?.title && <span>Selected Observation: {selectedObservation.title}</span>}
      <div className="header-item">
        <span>
          Observing Night {observingNight} @ {site}
        </span>
      </div>
      <IconField iconPosition="left">
        <InputIcon>
          <Search />
        </InputIcon>
        <InputText
          value={filters.global?.value ?? ''}
          onChange={(e) => setGlobalFilterValue(e.target.value)}
          placeholder="Keyword Search"
        />
      </IconField>
      <MultiSelect
        selectedItemsLabel={`${visibleColumns.length} columns selected`}
        maxSelectedLabels={2}
        value={visibleColumns}
        options={columns}
        onChange={onMultiSelectChange}
        optionLabel="header"
        placeholder="Select columns"
      />
    </div>
  );

  return (
    <div className="target-table">
      <DataTable
        value={observations}
        paginator
        selectionMode="single"
        selection={selectedObservation}
        onSelectionChange={(e) => setSelectedObservation(e.value as OdbObservationType | null)}
        className="p-datatable-customers"
        rows={15}
        dataKey="id"
        filters={filters}
        filterDisplay="row"
        loading={loading}
        onFilter={(e) => setFilters(e.filters as Filters)}
        globalFilterFields={visibleColumns.map((c) => c.field)}
        header={header}
        emptyMessage="No observations found."
      >
        {visibleColumns.map((column) => (
          <Column {...column} key={column.field} filter />
        ))}
      </DataTable>
    </div>
  );
}
