import { t } from '@lingui/macro';
import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core';
import { IconCirclePlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../../App';
import { PassFailButton } from '../../components/buttons/YesNoButton';
import { ApiFormFieldSet } from '../../components/forms/fields/ApiFormField';
import { RenderUser } from '../../components/render/User';
import { formatDate } from '../../defaults/formatters';
import { ApiEndpoints } from '../../enums/ApiEndpoints';
import { useTestResultFields } from '../../forms/StockForms';
import { useCreateApiFormModal } from '../../hooks/UseForm';
import { useTable } from '../../hooks/UseTable';
import { apiUrl } from '../../states/ApiState';
import { useUserState } from '../../states/UserState';
import { TableColumn } from '../Column';
import { LocationColumn } from '../ColumnRenderers';
import { TableFilter } from '../Filter';
import { InvenTreeTable } from '../InvenTreeTable';
import { RowAction } from '../RowActions';
import { TableHoverCard } from '../TableHoverCard';

/**
 * A table which displays all "test results" for the outputs generated by a build order.
 */
export default function BuildOrderTestTable({
  buildId,
  partId
}: Readonly<{
  buildId: number;
  partId: number;
}>) {
  const table = useTable('build-tests');
  const user = useUserState();

  // Fetch the test templates required for this build order
  const { data: testTemplates } = useQuery({
    queryKey: ['build-test-templates', partId, buildId],
    queryFn: async () => {
      if (!partId) {
        return [];
      }

      return api
        .get(apiUrl(ApiEndpoints.part_test_template_list), {
          params: {
            part: partId,
            include_inherited: true,
            enabled: true,
            required: true
          }
        })
        .then((res) => res.data)
        .catch((err) => []);
    }
  });

  // Reload the table data whenever the set of templates changes
  useEffect(() => {
    table.refreshTable();
  }, [testTemplates]);

  const [selectedOutput, setSelectedOutput] = useState<number>(0);
  const [selectedTemplate, setSelectedTemplate] = useState<number>(0);

  const testResultFields: ApiFormFieldSet = useTestResultFields({
    partId: partId,
    itemId: selectedOutput,
    templateId: selectedTemplate
  });

  const createTestResult = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.stock_test_result_list),
    title: t`Add Test Result`,
    fields: testResultFields,
    initialData: {
      template: selectedTemplate,
      result: true
    },
    onFormSuccess: () => table.refreshTable(),
    successMessage: t`Test result added`
  });

  // Generate a table column for each test template
  const testColumns: TableColumn[] = useMemo(() => {
    if (!testTemplates || testTemplates.length == 0) {
      return [];
    }

    return testTemplates.map((template: any) => {
      return {
        accessor: `test_${template.pk}`,
        title: template.test_name,
        sortable: false,
        switchable: true,
        render: (record: any) => {
          let tests = record.tests || [];

          // Find the most recent test result (highest primary key)
          let test = tests
            .filter((test: any) => test.template == template.pk)
            .sort((a: any, b: any) => b.pk - a.pk)
            .shift();

          // No test result recorded
          if (!test || test.result === undefined) {
            return (
              <Group gap="xs" wrap="nowrap" justify="space-between">
                <Badge color="lightblue" variant="filled">{t`No Result`}</Badge>
                <Tooltip label={t`Add Test Result`}>
                  <ActionIcon
                    size="xs"
                    color="green"
                    variant="transparent"
                    onClick={() => {
                      setSelectedOutput(record.pk);
                      setSelectedTemplate(template.pk);
                      createTestResult.open();
                    }}
                  >
                    <IconCirclePlus />
                  </ActionIcon>
                </Tooltip>
              </Group>
            );
          }

          let extra: ReactNode[] = [];

          if (test.value) {
            extra.push(
              <Text key="value" size="sm">
                {t`Value`}: {test.value}
              </Text>
            );
          }

          if (test.notes) {
            extra.push(
              <Text key="notes" size="sm">
                {t`Notes`}: {test.notes}
              </Text>
            );
          }

          if (test.date) {
            extra.push(
              <Text key="date" size="sm">
                {t`Date`}: {formatDate(test.date)}
              </Text>
            );
          }

          if (test.user_detail) {
            extra.push(<RenderUser key="user" instance={test.user_detail} />);
          }

          return (
            <TableHoverCard
              value={<PassFailButton value={test.result} />}
              title={template.test_name}
              extra={extra}
            />
          );
        }
      };
    });
  }, [testTemplates]);

  const tableColumns: TableColumn[] = useMemo(() => {
    // Fixed columns
    let columns: TableColumn[] = [
      {
        accessor: 'stock',
        title: t`Build Output`,
        sortable: true,
        switchable: false,
        render: (record: any) => {
          if (record.serial) {
            return `# ${record.serial}`;
          } else {
            let extra: ReactNode[] = [];

            if (record.batch) {
              extra.push(
                <Text key="batch" size="sm">
                  {t`Batch Code`}: {record.batch}
                </Text>
              );
            }

            return (
              <TableHoverCard
                value={
                  <Text>
                    {t`Quantity`}: {record.quantity}
                  </Text>
                }
                title={t`Build Output`}
                extra={extra}
              />
            );
          }
        }
      },
      LocationColumn({
        accessor: 'location_detail'
      })
    ];

    return [...columns, ...testColumns];
  }, [testColumns]);

  const tableFilters: TableFilter[] = useMemo(() => {
    return [
      {
        name: 'is_building',
        label: t`In Production`,
        description: t`Show build outputs currently in production`
      }
    ];
  }, []);

  const tableActions = useMemo(() => {
    return [];
  }, []);

  const rowActions = useCallback(
    (record: any): RowAction[] => {
      return [];
    },
    [user]
  );

  return (
    <>
      {createTestResult.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.stock_item_list)}
        tableState={table}
        columns={tableColumns}
        props={{
          params: {
            part_detail: true,
            location_detail: true,
            tests: true,
            build: buildId
          },
          rowActions: rowActions,
          tableFilters: tableFilters,
          tableActions: tableActions
        }}
      />
    </>
  );
}
