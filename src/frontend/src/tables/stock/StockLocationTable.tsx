import { t } from '@lingui/macro';
import { useCallback, useMemo, useState } from 'react';

import { AddItemButton } from '../../components/buttons/AddItemButton';
import { ApiEndpoints } from '../../enums/ApiEndpoints';
import { ModelType } from '../../enums/ModelType';
import { UserRoles } from '../../enums/Roles';
import { stockLocationFields } from '../../forms/StockForms';
import { useFilters } from '../../hooks/UseFilter';
import {
  useCreateApiFormModal,
  useEditApiFormModal
} from '../../hooks/UseForm';
import { useTable } from '../../hooks/UseTable';
import { apiUrl } from '../../states/ApiState';
import { useUserState } from '../../states/UserState';
import { TableColumn } from '../Column';
import { BooleanColumn, DescriptionColumn } from '../ColumnRenderers';
import { TableFilter } from '../Filter';
import { InvenTreeTable } from '../InvenTreeTable';
import { RowEditAction } from '../RowActions';

/**
 * Stock location table
 */
export function StockLocationTable({ parentId }: { parentId?: any }) {
  const table = useTable('stocklocation');
  const user = useUserState();

  const locationTypeFilters = useFilters({
    url: apiUrl(ApiEndpoints.stock_location_type_list),
    transform: (item) => ({
      value: item.pk,
      label: item.name
    })
  });

  const tableFilters: TableFilter[] = useMemo(() => {
    return [
      {
        name: 'cascade',
        label: t`Include Sublocations`,
        description: t`Include sublocations in results`
      },
      {
        name: 'structural',
        label: t`Structural`,
        description: t`Show structural locations`
      },
      {
        name: 'external',
        label: t`External`,
        description: t`Show external locations`
      },
      {
        name: 'has_location_type',
        label: t`Has location type`
      },
      {
        name: 'location_type',
        label: t`Location Type`,
        description: t`Filter by location type`,
        choices: locationTypeFilters.choices
      }
    ];
  }, [locationTypeFilters.choices]);

  const tableColumns: TableColumn[] = useMemo(() => {
    return [
      {
        accessor: 'name',
        switchable: false
      },
      DescriptionColumn({}),
      {
        accessor: 'pathstring',
        sortable: true
      },
      {
        accessor: 'items',
        sortable: true
      },
      BooleanColumn({
        accessor: 'structural'
      }),
      BooleanColumn({
        accessor: 'external'
      }),
      {
        accessor: 'location_type',
        sortable: false,
        render: (record: any) => record.location_type_detail?.name
      }
    ];
  }, []);

  const newLocation = useCreateApiFormModal({
    url: ApiEndpoints.stock_location_list,
    title: t`Add Stock Location`,
    fields: stockLocationFields(),
    focus: 'name',
    initialData: {
      parent: parentId
    },
    follow: true,
    modelType: ModelType.stocklocation,
    table: table
  });

  const [selectedLocation, setSelectedLocation] = useState<number>(-1);

  const editLocation = useEditApiFormModal({
    url: ApiEndpoints.stock_location_list,
    pk: selectedLocation,
    title: t`Edit Stock Location`,
    fields: stockLocationFields(),
    onFormSuccess: (record: any) => table.updateRecord(record)
  });

  const tableActions = useMemo(() => {
    let can_add = user.hasAddRole(UserRoles.stock_location);

    return [
      <AddItemButton
        tooltip={t`Add Stock Location`}
        onClick={() => newLocation.open()}
        hidden={!can_add}
      />
    ];
  }, [user]);

  const rowActions = useCallback(
    (record: any) => {
      let can_edit = user.hasChangeRole(UserRoles.stock_location);

      return [
        RowEditAction({
          hidden: !can_edit,
          onClick: () => {
            setSelectedLocation(record.pk);
            editLocation.open();
          }
        })
      ];
    },
    [user]
  );

  return (
    <>
      {newLocation.modal}
      {editLocation.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.stock_location_list)}
        tableState={table}
        columns={tableColumns}
        props={{
          enableSelection: true,
          enableDownload: true,
          enableLabels: true,
          enableReports: true,
          params: {
            parent: parentId,
            top_level: parentId === undefined ? true : undefined
          },
          tableFilters: tableFilters,
          tableActions: tableActions,
          rowActions: rowActions,
          modelType: ModelType.stocklocation
        }}
      />
    </>
  );
}
