import axios from 'axios';
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { Component } from "react";
import { useState } from 'react';
import { Text } from '@mantine/core';

import { useQuery } from '@tanstack/react-query';
import { api, queryClient } from '../../App';

/**
 * Table Component which extends DataTable with custom InvenTree functionality
 */

export function InvenTreeTable({
    url,
    params,
    columns,
    paginated=true,
    pageSize=25,
    tableKey=''
} : {
    url: string;
    params: any;
    columns: any;
    paginated: boolean;
    pageSize: number;
    tableKey: string;
}) {

    const [page, setPage] = useState(1);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({ columnAccessor: '', direction: 'asc' });

    const handleSortStatusChange = (status: DataTableSortStatus) => {
        setPage(1);
        setSortStatus(status);
    };

    // Function to perform API query to fetch required data
    const fetchTableData = async() => {
        
        let queryParams = Object.assign({}, params);

        // Handle pagination
        if (paginated) {
            queryParams.limit = PAGE_SIZE;
            queryParams.offset = (page - 1) * PAGE_SIZE;
        }

        // Handle sorting
        if (sortStatus.columnAccessor) {
            if (sortStatus.direction == 'asc') {
                queryParams.ordering = sortStatus.columnAccessor;
            } else {
                queryParams.ordering = `-${sortStatus.columnAccessor}`;
            }
        }
            
        return api
            .get(`http://localhost:8000/api/${url}`, {params: queryParams})
            .then((response) => response.data);
    }

    const { data, isFetching } = useQuery(
        [`table-${tableKey}`, sortStatus.columnAccessor, sortStatus.direction, page],
        async() => fetchTableData(),
        { refetchOnWindowFocus: false }
    );

    const PAGE_SIZE = 25;

    // TODO: Enable pagination
    // TODO: Handle data sorting

    return <DataTable
        withBorder
        totalRecords={data?.count ?? data?.length ?? 0}
        recordsPerPage={PAGE_SIZE}
        page={page}
        onPageChange={setPage}
        sortStatus={sortStatus}
        onSortStatusChange={handleSortStatusChange}
        fetching={isFetching}
        records={data?.results ?? data ?? []}
        columns={columns}
    />;
}
