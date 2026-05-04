import { useEngineeringTargets } from '@gql/configs/EngineeringTarget';
import type { EngineeringTargetItemFragment } from '@gql/configs/gen/graphql';
import { FilterMatchMode } from 'primereact/api';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { useState } from 'react';

interface ParamsInterface {
  selectedTarget: EngineeringTargetItemFragment | null;
  setSelectedTarget: (_: EngineeringTargetItemFragment | null) => void;
  headerItems?: React.ReactNode;
}

export function CatalogTable({ selectedTarget, setSelectedTarget, headerItems }: ParamsInterface) {
  const [filters, setFilters] = useState({
    name: { value: '', matchMode: FilterMatchMode.CONTAINS },
    type: { value: '', matchMode: FilterMatchMode.CONTAINS },
    global: { value: '', matchMode: FilterMatchMode.CONTAINS },
  });
  const [globalFilterValue, setGlobalFilterValue] = useState('');

  function onGlobalFilterChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;

    setFilters((prev) => ({
      ...prev,
      global: { ...filters.global, value: value },
    }));
    setGlobalFilterValue(value);
  }

  const { data: engineeringTargets, loading } = useEngineeringTargets();

  const header = (
    <div className="header-table">
      {selectedTarget?.name && <span>Selected Target: {selectedTarget.name}</span>}
      {headerItems}
      <IconField iconPosition="left">
        <InputIcon className="pi pi-search" />
        <InputText value={globalFilterValue} onChange={onGlobalFilterChange} placeholder="Keyword Search" />
      </IconField>
    </div>
  );

  return (
    <div className="target-table">
      <DataTable
        value={engineeringTargets}
        paginator
        selectionMode="single"
        selection={selectedTarget}
        onSelectionChange={(e) => setSelectedTarget(e.value as EngineeringTargetItemFragment)}
        className="p-datatable-customers"
        rows={15}
        dataKey="id"
        filters={filters}
        filterDisplay="row"
        loading={loading}
        globalFilterFields={['id', 'name', 'type']}
        header={header}
        emptyMessage="No observations found."
      >
        <Column field="name" header="Name" filter filterPlaceholder="Search name" style={{ minWidth: '12rem' }} />
        <Column field="type" header="Type" filter filterPlaceholder="Search type" style={{ minWidth: '12rem' }} />
        <Column field="az.dms" header="Az" filter filterPlaceholder="Search Az" style={{ minWidth: '12rem' }} />
        <Column field="el.dms" header="El" filter filterPlaceholder="Search El" style={{ minWidth: '12rem' }} />
      </DataTable>
    </div>
  );
}
