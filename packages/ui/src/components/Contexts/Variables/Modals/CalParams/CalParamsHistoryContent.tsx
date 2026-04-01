import { formatDateTime } from '@gemini-hlsw/lucuma-common-ui';
import { useCalParamsHistory, useDeleteCalParams } from '@gql/configs/CalParams';
import type { CalParamsHistory as CalParamsHistoryType } from '@gql/configs/gen/graphql';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { DataTable } from 'primereact/datatable';
import { useRef } from 'react';

import { useServerConfigValue } from '@/components/atoms/config';
import { Trash } from '@/components/Icons';

export function CalParamsHistoryContent({
  canEdit,
  selection,
  setSelection,
  loading: loadingProp,
}: {
  canEdit: boolean;
  selection: CalParamsHistoryType | null;
  setSelection: (_: CalParamsHistoryType | null) => void;
  loading: boolean;
}) {
  const { site } = useServerConfigValue();

  const { data: historyData, loading: historyLoading } = useCalParamsHistory(site);

  const [deleteParams, { loading: deleteLoading }] = useDeleteCalParams();

  const loading = loadingProp || historyLoading || deleteLoading;
  const disabled = loading || !canEdit;

  const isCurrentEntry = (entry: CalParamsHistoryType) => entry.pk === historyData?.calParamsHistory?.[0]?.pk;

  const tableData =
    historyData?.calParamsHistory?.map((entry) => ({
      ...entry,
      createdAt: new Date(entry.createdAt) as unknown as string,
    })) ?? [];

  return (
    <div className="cal-params-history-table">
      <DataTable
        value={tableData}
        selection={selection}
        onSelectionChange={(e) => setSelection(e.value as CalParamsHistoryType)}
        selectionMode="single"
        scrollable
        disabled={disabled}
        scrollHeight="flex"
        dataKey="pk"
        loading={loading}
        isDataSelectable={(e) => !isCurrentEntry(e.data as CalParamsHistoryType)}
        filterDisplay="row"
        emptyMessage="No calibration parameters history available."
      >
        <Column
          field="createdAt"
          header="Created"
          sortable
          dataType="date"
          body={(c: CalParamsHistoryType) => formatDateTime(c.createdAt, false)}
        />
        <Column
          field="comment"
          header="Comment"
          sortable
          bodyStyle={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
        />
        <Column
          header="Actions"
          headerStyle={{ width: '5rem', textAlign: 'center' }}
          bodyStyle={{ textAlign: 'center', overflow: 'visible' }}
          body={(c: CalParamsHistoryType) =>
            isCurrentEntry(c) ? null : (
              <DeleteCalParamsButton onDelete={() => deleteParams({ variables: { pk: c.pk } })} />
            )
          }
        />
      </DataTable>
      <ConfirmPopup />
    </div>
  );
}

function DeleteCalParamsButton({ onDelete, tooltip }: { onDelete: () => void; tooltip?: string }) {
  const ref = useRef<Button>(null);

  return (
    <div className="cal-params-delete-button-wrapper">
      <Button
        ref={ref}
        icon={<Trash />}
        outlined
        severity="danger"
        tooltip={tooltip ?? 'Delete entry'}
        onClick={() =>
          confirmPopup({
            target: ref.current as unknown as HTMLElement,
            message: 'Are you sure you want to delete this entry?',
            accept: () => onDelete(),
          })
        }
      />
    </div>
  );
}
