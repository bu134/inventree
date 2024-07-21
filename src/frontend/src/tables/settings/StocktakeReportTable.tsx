import { t } from '@lingui/macro';
import { useCallback, useMemo, useState } from 'react';

import { AttachmentLink } from '../../components/items/AttachmentLink';
import { RenderUser } from '../../components/render/User';
import { ApiEndpoints } from '../../enums/ApiEndpoints';
import { useDeleteApiFormModal } from '../../hooks/UseForm';
import { useTable } from '../../hooks/UseTable';
import { apiUrl } from '../../states/ApiState';
import { TableColumn } from '../Column';
import { DateColumn } from '../ColumnRenderers';
import { InvenTreeTable } from '../InvenTreeTable';
import { RowAction, RowDeleteAction } from '../RowActions';

export default function StocktakeReportTable() {
  const table = useTable('stocktake-report');

  const tableColumns: TableColumn[] = useMemo(() => {
    return [
      {
        accessor: 'report',
        title: t`Report`,
        sortable: false,
        switchable: false,
        render: (record: any) => <AttachmentLink attachment={record.report} />
      },
      {
        accessor: 'part_count',
        title: t`Part Count`,
        sortable: false
      },
      DateColumn({
        accessor: 'date',
        title: t`Date`
      }),
      {
        accessor: 'user',
        title: t`User`,
        sortable: false,
        render: (record: any) => RenderUser({ instance: record.user_detail })
      }
    ];
  }, []);

  const tableActions = useMemo(() => {
    return [];
  }, []);

  const [selectedReport, setSelectedReport] = useState<number | undefined>(
    undefined
  );

  const deleteReport = useDeleteApiFormModal({
    url: ApiEndpoints.part_stocktake_report_list,
    pk: selectedReport,
    title: t`Delete Report`,
    onFormSuccess: () => table.refreshTable()
  });

  const rowActions = useCallback((record: any): RowAction[] => {
    return [
      RowDeleteAction({
        onClick: () => {
          setSelectedReport(record.pk);
          deleteReport.open();
        }
      })
    ];
  }, []);

  return (
    <>
      {deleteReport.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.part_stocktake_report_list)}
        tableState={table}
        columns={tableColumns}
        props={{
          rowActions: rowActions
        }}
      />
    </>
  );
}
