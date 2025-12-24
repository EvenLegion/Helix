'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@workspace/ui/components/badge';
import { ArrowUpDown, Shield, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { authClient } from '@/lib/auth-client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@workspace/ui/components/table';
import {
    ColumnFiltersState,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Input } from '@workspace/ui/components/input';

export type User = {
    id: string;
    username?: string | null;
    nickname?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    createdAt: Date;
    Member: Array<{
        id: string;
        organizationId: string;
        role: string;
        organization: {
            id: string;
            name: string;
        };
    }>;
};

function SuperAdminButton({ user, canManageAdmin }: { user: User; canManageAdmin: boolean }) {
    const [isToggling, setIsToggling] = useState(false);
    const [isAdmin, setIsAdmin] = useState(user.role === 'admin');
    const router = useRouter();

    useEffect(() => {
        setIsAdmin(user.role === 'admin');
    }, [user.role]);

    if (!canManageAdmin) {
        return null;
    }

    const handleToggleAdmin = async () => {
        setIsToggling(true);
        try {
            const newRole = isAdmin ? 'user' : 'admin';
            const result = await authClient.admin.setRole({
                userId: user.id,
                role: newRole,
            });

            if ('error' in result && result.error) {
                toast.error(result.error.message || `Failed to ${isAdmin ? 'remove' : 'set'} admin status`);
                return;
            }

            setIsAdmin(!isAdmin);
            toast.success(
                `${user.username || user.nickname || user.id} is now ${newRole === 'admin' ? 'a super admin' : 'a regular user'}`
            );
            router.refresh();
        } catch (error) {
            console.error('Failed to toggle admin status:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to toggle admin status');
        } finally {
            setIsToggling(false);
        }
    };

    return (
        <Button
            size="sm"
            variant={isAdmin ? 'default' : 'secondary'}
            className={`h-8 ${isAdmin ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            onClick={handleToggleAdmin}
            disabled={isToggling}
            title={`${isAdmin ? 'Remove' : 'Set'} super admin status`}
        >
            {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAdmin ? (
                <ShieldCheck className="h-4 w-4" />
            ) : (
                <Shield className="h-4 w-4" />
            )}
        </Button>
    );
}

function ImpersonateUserButton({ user, canImpersonate }: { user: User; canImpersonate: boolean }) {
    const [isImpersonating, setIsImpersonating] = useState(false);
    const router = useRouter();

    if (!canImpersonate) {
        return null;
    }

    const handleImpersonate = async () => {
        setIsImpersonating(true);
        try {
            const result = await authClient.admin.impersonateUser({
                userId: user.id,
            });

            if ('error' in result && result.error) {
                toast.error(result.error.message || 'Failed to impersonate user');
                return;
            }

            toast.success(`Now impersonating ${user.username || user.nickname || user.id}`);
            router.refresh();
            // Full page reload to ensure session is updated
            window.location.reload();
        } catch (error) {
            console.error('Failed to impersonate user:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to impersonate user');
        } finally {
            setIsImpersonating(false);
        }
    };

    return (
        <Button
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={handleImpersonate}
            disabled={isImpersonating}
            title={`Impersonate ${user.username || user.nickname || user.id}`}
        >
            {isImpersonating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <UsersIcon className="h-4 w-4" />
            )}
        </Button>
    );
}

function getUsersColumns(
    permissions: { canManageAdmin: boolean; canImpersonate: boolean }
): ColumnDef<User>[] {
    return [
        {
            accessorKey: 'id',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        User ID
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div className="font-medium font-mono text-xs">{row.getValue('id')}</div>,
            filterFn: 'includesString',
        },
        {
            accessorKey: 'username',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Username
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const user = row.original;
                const displayName = user.nickname || user.username || user.name || user.id;
                return (
                    <div className="flex items-center gap-2">
                        <span>{displayName}</span>
                        {user.role === 'admin' && (
                            <Badge variant="default" className="bg-amber-600 text-white text-xs">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Admin
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'email',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Email
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div className="text-sm">{row.getValue('email') || '-'}</div>,
        },
        {
            id: 'organizations',
            header: 'Organizations',
            cell: ({ row }) => {
                const members = row.original.Member;
                if (members.length === 0) {
                    return <span className="text-muted-foreground text-sm">No organizations</span>;
                }
                return (
                    <div className="flex flex-wrap gap-1">
                        {members.map((member) => (
                            <Badge key={member.id} variant="outline" className="text-xs">
                                {member.organization.name}
                            </Badge>
                        ))}
                    </div>
                );
            },
        },
        {
            accessorKey: 'createdAt',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Created At
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const date = row.getValue<Date>('createdAt');
                return <div className="text-sm">{new Date(date).toLocaleDateString()}</div>;
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    <SuperAdminButton user={row.original} canManageAdmin={permissions.canManageAdmin} />
                    <ImpersonateUserButton user={row.original} canImpersonate={permissions.canImpersonate} />
                </div>
            ),
        },
    ];
}

export function UsersTable({ users }: { users: User[] }) {
    const [permissions, setPermissions] = useState({
        canManageAdmin: false,
        canImpersonate: false,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    useEffect(() => {
        let isMounted = true;

        const checkPermissions = async () => {
            setIsLoading(true);
            try {
                // Check if current user is admin to allow managing admin status
                const session = await authClient.getSession();
                const isCurrentUserAdmin = session.data?.user?.role === 'admin';

                const [impersonateResult] = await Promise.all([
                    authClient.organization.hasPermission({
                        permissions: { user: ['impersonate'] }
                    }),
                ]);

                if (!isMounted) return;

                const getSuccess = (result: typeof impersonateResult) => {
                    if ('error' in result && result.error) return false;
                    if ('data' in result) return result.data.success ?? false;
                    return false;
                };

                setPermissions({
                    canManageAdmin: isCurrentUserAdmin ?? false,
                    canImpersonate: getSuccess(impersonateResult),
                });
            } catch (error) {
                console.error('Error checking permissions:', error);
                if (isMounted) {
                    setPermissions({
                        canManageAdmin: false,
                        canImpersonate: false,
                    });
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        checkPermissions();

        return () => {
            isMounted = false;
        };
    }, []);

    const permissionsRef = useMemo(
        () => permissions,
        [permissions.canManageAdmin, permissions.canImpersonate]
    );

    const columns = useMemo(
        () => getUsersColumns(permissionsRef),
        [permissionsRef]
    );

    const table = useReactTable({
        data: users,
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
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Search all columns..."
                    value={globalFilter ?? ''}
                    onChange={(event) => setGlobalFilter(event.target.value)}
                    className="max-w-sm"
                />
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() ? 'selected' : undefined}
                                >
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
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
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

