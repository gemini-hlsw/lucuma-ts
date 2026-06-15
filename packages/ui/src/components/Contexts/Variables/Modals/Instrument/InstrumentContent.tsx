import { skipToken } from '@apollo/client/react';
import { formatDateTime, when } from '@gemini-hlsw/lucuma-common-ui';
import {
  useConfiguredInstrument,
  useDeleteInstrument,
  useDistinctInstruments,
  useDistinctPorts,
  useInstruments,
} from '@gql/configs/Instrument';
import type { Instrument as InstrumentName } from '@gql/odb/gen/graphql';
import { FilterMatchMode, FilterService } from 'primereact/api';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { useMountEffect } from 'primereact/hooks';
import { MultiSelect } from 'primereact/multiselect';
import { useRef, useState } from 'react';

import { useServerConfigValue } from '@/components/atoms/config';
import { CircleCheck, CircleXMark, Trash } from '@/components/Icons';
import type { InstrumentConfig } from '@/types';

export function InstrumentContent({
  instrument,
  setInstrument,
  onImport,
  loading: importLoading,
}: {
  instrument: InstrumentConfig | null;
  setInstrument: (_: InstrumentConfig | null) => void;
  onImport: (_: InstrumentConfig) => void;
  loading: boolean;
}) {
  const { site } = useServerConfigValue();
  const { data: configuredInstrument, loading: configuredInstrumentLoading } = useConfiguredInstrument();

  const [name, setName] = useState<InstrumentName | null>(configuredInstrument?.name ?? null);
  const [port, setPort] = useState(configuredInstrument?.issPort ?? null);

  const [deleteInstrument, { loading: deleteInstrumentLoading }] = useDeleteInstrument();

  const { data: distinctInstrumentsData, loading: distinctInstrumentsLoading } = useDistinctInstruments({
    variables: { site },
  });
  const { data: distinctPortsData, loading: distinctPortsLoading } = useDistinctPorts(
    !name ? skipToken : { variables: { name } },
  );
  const { data: instrumentsData, loading: instrumentsLoading } = useInstruments(
    !name || !port ? skipToken : { fetchPolicy: 'cache-and-network', variables: { name, issPort: port } },
  );

  const nameOptions = distinctInstrumentsData?.distinctInstruments ?? [];
  const portOptions = distinctPortsData?.distinctPorts ?? [];

  const loading =
    importLoading ||
    distinctInstrumentsLoading ||
    distinctPortsLoading ||
    instrumentsLoading ||
    deleteInstrumentLoading ||
    configuredInstrumentLoading;

  return (
    <div className="import-instrument" data-testid="import-instrument-modal-content">
      <div className="selectors">
        <label htmlFor="instrument-import-name">Instrument</label>
        <Dropdown
          inputId="instrument-import-name"
          value={name}
          loading={loading}
          options={nameOptions}
          onChange={(e) => {
            setName(e.value as InstrumentName);
            setPort(null);
            setInstrument(null);
          }}
          placeholder="Select instrument"
        />
        <label htmlFor="instrument-import-issPort">issPort</label>
        <Dropdown
          inputId="instrument-import-issPort"
          loading={loading}
          disabled={portOptions.length <= 0 || !name}
          value={port}
          options={portOptions}
          onChange={(e) => {
            setPort(e.value as number);
            setInstrument(null);
          }}
          placeholder="Select port"
        />
      </div>
      {when(port && name, () => (
        <InstrumentTable
          instruments={instrumentsData?.instruments ?? []}
          selectedInstrument={instrument}
          setInstrument={setInstrument}
          onImport={onImport}
          deleteInstrument={(pk) => deleteInstrument({ variables: { pk } })}
          loading={loading}
        />
      ))}
    </div>
  );
}

function InstrumentTable({
  instruments,
  selectedInstrument,
  setInstrument,
  onImport,
  deleteInstrument,
  loading,
}: {
  instruments: InstrumentConfig[];
  selectedInstrument: InstrumentConfig | null;
  setInstrument: (_: InstrumentConfig) => void;
  onImport: (_: InstrumentConfig) => void;
  deleteInstrument: (pk: number) => void;
  loading: boolean;
}) {
  const tableData = instruments.filter((i) => !i.isTemporary).map((i) => ({ ...i, createdAt: new Date(i.createdAt) }));

  const uniqueWfs = Array.from(new Set(tableData.map((i) => i.wfs)));

  const makeDeleteInstrumentButton = (i: InstrumentConfig) => (
    <DeleteInstrumentButton instrument={i} onDelete={deleteInstrument} />
  );

  useMountEffect(() => {
    FilterService.register('custom_extraParams', (value, filter: string) =>
      JSON.stringify(value, undefined, 2).includes(filter),
    );
  });

  return (
    <>
      <DataTable
        value={tableData}
        selection={selectedInstrument}
        onSelectionChange={(e) => setInstrument(e.value as InstrumentConfig)}
        onRowDoubleClick={(e) => onImport(e.data as InstrumentConfig)}
        selectionMode="single"
        scrollable
        scrollHeight="flex"
        dataKey="pk"
        loading={loading}
        filterDisplay="row"
        emptyMessage="No instruments found."
      >
        <Column
          field="createdAt"
          header="Created"
          sortable
          dataType="date"
          body={(i: InstrumentConfig) => formatDateTime(i.createdAt, false)}
        />
        <Column
          field="wfs"
          header="WFS"
          sortable
          filter
          filterMatchMode={FilterMatchMode.IN}
          showFilterMenu={false}
          // eslint-disable-next-line @typescript-eslint/unbound-method
          filterElement={({ filterApplyCallback, value }) => (
            <MultiSelect
              placeholder="Filter WFS"
              value={value as string[] | null}
              options={uniqueWfs}
              onChange={(e) => filterApplyCallback(e.value)}
              style={{ maxWidth: '8rem' }}
            />
          )}
        />
        <Column
          field="extraParams"
          header="Extra Params"
          filter
          filterPlaceholder="Filter params"
          filterMatchMode={FilterMatchMode.CUSTOM}
          body={(i: InstrumentConfig) => JSON.stringify(i.extraParams, undefined, 2)}
          showFilterMenu={false}
        />
        <Column
          field="ao"
          header="AO"
          headerTooltip="Adaptive Optics"
          dataType="boolean"
          body={(i: InstrumentConfig) => (i.ao ? <CircleCheck /> : <CircleXMark />)}
          style={{ minWidth: '3rem' }}
        />
        <Column field="originX" header="Origin X" dataType="numeric" style={{ minWidth: '4rem' }} />
        <Column field="originY" header="Origin Y" dataType="numeric" style={{ minWidth: '4rem' }} />
        <Column field="focusOffset" header="Focus Offset" dataType="numeric" style={{ minWidth: '6rem' }} />
        <Column field="iaa" header="IAA" />
        <Column field="comment" header="Comment" />
        <Column
          headerStyle={{ width: '5rem', textAlign: 'center' }}
          bodyStyle={{ textAlign: 'center', overflow: 'visible' }}
          body={makeDeleteInstrumentButton}
        />
      </DataTable>
      <ConfirmPopup />
    </>
  );
}

function DeleteInstrumentButton({
  onDelete,
  instrument,
}: {
  instrument: InstrumentConfig;
  onDelete: (pk: number) => void;
}) {
  const ref = useRef<Button>(null);
  return (
    <Button
      ref={ref}
      icon={<Trash />}
      outlined
      severity="danger"
      tooltip="Delete entry"
      onClick={() =>
        confirmPopup({
          target: ref.current as unknown as HTMLElement,
          message: 'Are you sure you want to delete this entry?',
          accept: () => onDelete(instrument.pk),
        })
      }
    />
  );
}
