'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@workspace/ui/components/badge';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table';
import {
    ColumnFiltersState,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ApplicationReviewDialog } from './application-review-dialog';
import { authClient } from '@/lib/auth-client';
import { Input } from '@workspace/ui/components/input';

export type Application = {
    id: string;
    userId: string;
    rsiHandle: string;
    age: number;
    combatExperience: number;
    logisticsExperience: number;
    supportExperience: number;
    starCitizenExperience: string | null;
    top3ShipsWhy: string;
    whenStartPlayingSC: string;
    whyJoin: string;
    canCommitToDiscord: boolean;
    status: string;
    appliedAt: Date;
    reviewedAt?: Date | null;
    reviewedBy?: string | null;
    user: {
        username?: string | null;
        email?: string | null;
    };
};

function getColumns(permissions: {
    canAccept: boolean;
    canReject: boolean;
    canDelete: boolean;
}): ColumnDef<Application>[] {
    return [
        {
            accessorKey: 'rsiHandle',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    RSI Handle
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
        },
        {
            accessorKey: 'user.username',
            header: 'Username',
            cell: ({ row }) => row.original.user.username || 'N/A',
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.getValue<string>('status');
                return (
                    <Badge
                        variant={
                            status === 'accepted' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'
                        }
                    >
                        {status}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'appliedAt',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Applied At
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => new Date(row.getValue<string>('appliedAt')).toLocaleDateString(),
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => <ApplicationReviewDialog application={row.original} permissions={permissions} />,
        },
    ];
}

export function ApplicationsTable({ applications }: { applications: Application[] }) {
    const [permissions, setPermissions] = useState({
        canAccept: false,
        canReject: false,
        canDelete: false,
    });
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    useEffect(() => {
        async function checkPerms() {
            const [acceptRes, rejectRes, deleteRes] = await Promise.all([
                authClient.organization.hasPermission({
                    permissions: { recruitment: ['accept'] },
                }),
                authClient.organization.hasPermission({
                    permissions: { recruitment: ['reject'] },
                }),
                authClient.organization.hasPermission({
                    permissions: { recruitment: ['delete'] },
                }),
            ]);

            setPermissions({
                canAccept: acceptRes.data?.success ?? false,
                canReject: rejectRes.data?.success ?? false,
                canDelete: deleteRes.data?.success ?? false,
            });
        }

        checkPerms();
    }, []);

    const columns = useMemo(() => getColumns(permissions), [permissions]);

    const table = useReactTable({
        data: applications,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            columnFilters,
            globalFilter,
        },
    });

    return (
        <div className="space-y-4">
            <Input
                placeholder="Search applications..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm"
            />
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No applications found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    Next
                </Button>
            </div>
        </div>
    );
}
