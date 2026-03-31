import { formatDateTime } from '@gemini-hlsw/lucuma-common-ui';
import type { LogMessage } from '@gql/server/gen/graphql';
import { useLogMessages } from '@gql/server/Logs';
import { Title } from '@Shared/Title/Title';
import { parseJSON } from 'date-fns';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';

export default function Logs() {
  const { data: messages } = useLogMessages();

  return (
    <div className="logs-table">
      <Title title="Log" />
      <DataTable
        value={messages}
        rowClassName={(data: LogMessage) => data.level.toLowerCase()}
        stripedRows
        dataKey="id"
        emptyMessage="No logs yet"
        // https://github.com/primefaces/primereact/issues/7321#issuecomment-2407955675
        onMouseDownCapture={(e) => {
          e.stopPropagation();
        }}
      >
        <Column
          field="timestamp"
          header="Timestamp"
          className="text-small text-nowrap"
          body={(t: LogMessage) => formatDateTime(parseJSON(t.timestamp), true)}
        ></Column>
        <Column field="message" header="Message" className="log-message text-small"></Column>
      </DataTable>
    </div>
  );
}
