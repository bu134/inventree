import { t } from '@lingui/macro';
import { useMemo } from 'react';

import { notYetImplemented } from '../../../functions/notifications';
import { useTableRefresh } from '../../../hooks/TableRefresh';
import { TableColumn } from '../Column';
import { InvenTreeTable, InvenTreeTableProps } from '../InvenTreeTable';
import { RowAction } from '../RowActions';

/**
 * Table displaying list of available plugins
 */
export function PluginListTable({ props }: { props: InvenTreeTableProps }) {
  const { tableKey, refreshTable } = useTableRefresh('plugin');

  const pluginTableColumns: TableColumn[] = useMemo(
    () => [
      {
        accessor: 'name',
        title: t`Plugin`,
        sortable: true
        // TODO: Add link to plugin detail page
        // TODO: Add custom badges
      },
      {
        accessor: 'meta.description',
        title: t`Description`,
        sortable: false,
        switchable: true
      },
      {
        accessor: 'meta.version',
        title: t`Version`,
        sortable: false,
        switchable: true
        // TODO: Display date information if available
      },
      {
        accessor: 'meta.author',
        title: 'Author',
        sortable: true
      }
    ],
    []
  );

  // Determine available actions for a given plugin
  function rowActions(record: any): RowAction[] {
    let actions: RowAction[] = [];

    if (!record.is_builtin && record.is_installed) {
      if (record.active) {
        actions.push({
          title: t`Deactivate`,
          color: 'red',
          onClick: () => {
            notYetImplemented();
          }
        });
      } else {
        actions.push({
          title: t`Activate`,
          onClick: () => {
            notYetImplemented();
          }
        });
      }
    }

    return actions;
  }

  return (
    <InvenTreeTable
      url="plugins/"
      tableKey={tableKey}
      columns={pluginTableColumns}
      props={{
        ...props,
        enableDownload: false,
        params: {
          ...props.params
        },
        rowActions: rowActions,
        customFilters: [
          {
            name: 'active',
            label: t`Active`,
            type: 'boolean'
          },
          {
            name: 'builtin',
            label: t`Builtin`,
            type: 'boolean'
          },
          {
            name: 'sample',
            label: t`Sample`,
            type: 'boolean'
          },
          {
            name: 'installed',
            label: t`Installed`,
            type: 'boolean'
          }
        ]
      }}
    />
  );
}
