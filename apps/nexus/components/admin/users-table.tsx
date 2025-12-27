'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@workspace/ui/components/badge';
import { ArrowUpDown, Shield, ShieldCheck, Users as UsersIcon, Ban, CheckCircle2, UserCheck, MoreHorizontal } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { authClient } from '@/lib/auth-client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
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
    banned?: boolean | null;
    banReason?: string | null;
    banExpires?: Date | null;
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

function ModeratorRoleButton({ user, canManageAdmin }: { user: User; canManageAdmin: boolean }) {
    const [isToggling, setIsToggling] = useState(false);
    const [isModerator, setIsModerator] = useState(user.role === 'moderator');
    const router = useRouter();

    useEffect(() => {
        setIsModerator(user.role === 'moderator');
    }, [user.role]);

    if (!canManageAdmin) {
        return null;
    }

    const handleToggleModerator = async () => {
        setIsToggling(true);
        try {
            // If user is admin, don't allow changing to moderator (admins have all permissions)
            if (user.role === 'admin') {
                toast.error('Cannot change admin role to moderator. Remove admin status first.');
                setIsToggling(false);
                return;
            }

            const newRole = isModerator ? 'user' : 'moderator';
            const result = await authClient.admin.setRole({
                userId: user.id,
                role: newRole as any, // Type assertion needed as Better-auth types don't include custom roles yet
            });

            if ('error' in result && result.error) {
                toast.error(result.error.message || `Failed to ${isModerator ? 'remove' : 'set'} moderator status`);
                return;
            }

            setIsModerator(!isModerator);
            toast.success(
                `${user.username || user.nickname || user.id} is now ${newRole === 'moderator' ? 'a moderator' : 'a regular user'}`
            );
            router.refresh();
        } catch (error) {
            console.error('Failed to toggle moderator status:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to toggle moderator status');
        } finally {
            setIsToggling(false);
        }
    };
    // TODO: Change all of the buttons colors
    return (
        <Button
            size="sm"
            variant={isModerator ? 'default' : 'secondary'}
            className={`h-8 ${isModerator ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
            onClick={handleToggleModerator}
            disabled={isToggling || user.role === 'admin'}
            title={`${isModerator ? 'Remove' : 'Set'} moderator status`}
        >
            {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isModerator ? (
                <UserCheck className="h-4 w-4" />
            ) : (
                <UserCheck className="h-4 w-4" />
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

function BanUserButton({ user, canBan }: { user: User; canBan: boolean }) {
    const [isBanning, setIsBanning] = useState(false);
    const [isBanned, setIsBanned] = useState(user.banned ?? false);
    const router = useRouter();

    useEffect(() => {
        setIsBanned(user.banned ?? false);
    }, [user.banned]);

    if (!canBan) {
        return null;
    }

    const handleToggleBan = async () => {
        setIsBanning(true);
        try {
            let result;
            if (isBanned) {
                // Unban user
                result = await authClient.admin.unbanUser({
                    userId: user.id,
                });
            } else {
                // Ban user
                result = await authClient.admin.banUser({
                    userId: user.id,
                    banReason: 'Banned by administrator',
                });
            }

            if ('error' in result && result.error) {
                toast.error(result.error.message || `Failed to ${isBanned ? 'unban' : 'ban'} user`);
                return;
            }

            setIsBanned(!isBanned);
            toast.success(
                `${user.username || user.nickname || user.id} has been ${isBanned ? 'unbanned' : 'banned'}`
            );
            router.refresh();
        } catch (error) {
            console.error('Failed to toggle ban status:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to toggle ban status');
        } finally {
            setIsBanning(false);
        }
    };

    return (
        <Button
            size="sm"
            variant={isBanned ? 'default' : 'destructive'}
            className={`h-8 ${isBanned ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onClick={handleToggleBan}
            disabled={isBanning}
            title={`${isBanned ? 'Unban' : 'Ban'} ${user.username || user.nickname || user.id}`}
        >
            {isBanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isBanned ? (
                <CheckCircle2 className="h-4 w-4" />
            ) : (
                <Ban className="h-4 w-4" />
            )}
        </Button>
    );
}

function ActionsDropdown({
    user,
    permissions
}: {
    user: User;
    permissions: { canManageAdmin: boolean; canImpersonate: boolean; canBan: boolean };
}) {
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(user.role === 'admin');
    const [isModerator, setIsModerator] = useState(user.role === 'moderator');
    const [isBanned, setIsBanned] = useState(user.banned ?? false);
    const router = useRouter();

    useEffect(() => {
        setIsAdmin(user.role === 'admin');
        setIsModerator(user.role === 'moderator');
        setIsBanned(user.banned ?? false);
    }, [user.role, user.banned]);

    const handleToggleBan = async () => {
        setIsLoading('ban');
        try {
            const result = isBanned
                ? await authClient.admin.unbanUser({ userId: user.id })
                : await authClient.admin.banUser({ userId: user.id, banReason: 'Banned by administrator' });

            if ('error' in result && result.error) {
                toast.error(result.error.message || `Failed to ${isBanned ? 'unban' : 'ban'} user`);
                return;
            }

            setIsBanned(!isBanned);
            toast.success(`${user.username || user.nickname || user.id} has been ${isBanned ? 'unbanned' : 'banned'}`);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to toggle ban status');
        } finally {
            setIsLoading(null);
        }
    };

    const handleToggleModerator = async () => {
        if (user.role === 'admin') {
            toast.error('Cannot change admin role to moderator. Remove admin status first.');
            return;
        }

        setIsLoading('moderator');
        try {
            const newRole = isModerator ? 'user' : 'moderator';
            const result = await authClient.admin.setRole({ userId: user.id, role: newRole as any });

            if ('error' in result && result.error) {
                toast.error(result.error.message || `Failed to ${isModerator ? 'remove' : 'set'} moderator status`);
                return;
            }

            setIsModerator(!isModerator);
            toast.success(`${user.username || user.nickname || user.id} is now ${newRole === 'moderator' ? 'a moderator' : 'a regular user'}`);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to toggle moderator status');
        } finally {
            setIsLoading(null);
        }
    };

    const handleToggleAdmin = async () => {
        setIsLoading('admin');
        try {
            const newRole = isAdmin ? 'user' : 'admin';
            const result = await authClient.admin.setRole({ userId: user.id, role: newRole });

            if ('error' in result && result.error) {
                toast.error(result.error.message || `Failed to ${isAdmin ? 'remove' : 'set'} admin status`);
                return;
            }

            setIsAdmin(!isAdmin);
            toast.success(`${user.username || user.nickname || user.id} is now ${newRole === 'admin' ? 'a super admin' : 'a regular user'}`);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to toggle admin status');
        } finally {
            setIsLoading(null);
        }
    };

    const handleImpersonate = async () => {
        setIsLoading('impersonate');
        try {
            const result = await authClient.admin.impersonateUser({ userId: user.id });

            if ('error' in result && result.error) {
                toast.error(result.error.message || 'Failed to impersonate user');
                return;
            }

            toast.success(`Now impersonating ${user.username || user.nickname || user.id}`);
            router.refresh();
            window.location.reload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to impersonate user');
        } finally {
            setIsLoading(null);
        }
    };

    const hasAnyPermission = permissions.canBan || permissions.canManageAdmin || permissions.canImpersonate;

    if (!hasAnyPermission) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {permissions.canBan && (
                    <DropdownMenuItem onClick={handleToggleBan} disabled={isLoading !== null}>
                        {isLoading === 'ban' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isBanned ? (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                        ) : (
                            <Ban className="mr-2 h-4 w-4" />
                        )}
                        <span>{isBanned ? 'Unban User' : 'Ban User'}</span>
                    </DropdownMenuItem>
                )}

                {permissions.canManageAdmin && (
                    <>
                        <DropdownMenuItem
                            onClick={handleToggleModerator}
                            disabled={isLoading !== null || user.role === 'admin'}
                        >
                            {isLoading === 'moderator' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UserCheck className="mr-2 h-4 w-4" />
                            )}
                            <span>{isModerator ? 'Remove Moderator' : 'Set as Moderator'}</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={handleToggleAdmin} disabled={isLoading !== null}>
                            {isLoading === 'admin' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : isAdmin ? (
                                <ShieldCheck className="mr-2 h-4 w-4" />
                            ) : (
                                <Shield className="mr-2 h-4 w-4" />
                            )}
                            <span>{isAdmin ? 'Remove Admin' : 'Set as Admin'}</span>
                        </DropdownMenuItem>
                    </>
                )}

                {permissions.canImpersonate && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleImpersonate} disabled={isLoading !== null}>
                            {isLoading === 'impersonate' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UsersIcon className="mr-2 h-4 w-4" />
                            )}
                            <span>Impersonate User</span>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function getUsersColumns(
    permissions: { canManageAdmin: boolean; canImpersonate: boolean; canBan: boolean }
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
                        {user.role === 'moderator' && (
                            <Badge variant="default" className="bg-blue-600 text-white text-xs">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Moderator
                            </Badge>
                        )}
                        {user.banned && (
                            <Badge variant="destructive" className="text-xs">
                                <Ban className="h-3 w-3 mr-1" />
                                Banned
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
                <ActionsDropdown user={row.original} permissions={permissions} />
            ),
        },
    ];
}

export function UsersTable({ users }: { users: User[] }) {
    const [permissions, setPermissions] = useState({
        canManageAdmin: false,
        canImpersonate: false,
        canBan: false,
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
                // Get session and check user's role
                const session = await authClient.getSession();
                const userRole = session.data?.user?.role;

                // Users with User.role = 'admin' can manage roles (set admin/moderator)
                const isCurrentUserAdmin = userRole === 'admin';

                // Debug: Log session data
                console.log('[UsersTable] Session user role:', userRole);
                console.log('[UsersTable] Is admin:', isCurrentUserAdmin);

                // Check admin plugin permissions
                const [impersonateResult, banResult] = await Promise.all([
                    authClient.admin.hasPermission({
                        permissions: { user: ['impersonate'] }
                    }),
                    authClient.admin.hasPermission({
                        permissions: { user: ['ban'] }
                    }),
                ]);

                // Debug: Log permission results
                console.log('[UsersTable] Impersonate result:', impersonateResult);
                console.log('[UsersTable] Ban result:', banResult);

                if (!isMounted) return;

                const getSuccess = (result: typeof impersonateResult) => {
                    if ('error' in result && result.error) {
                        console.log('[UsersTable] Permission error:', result.error);
                        return false;
                    }
                    if ('data' in result) return result.data.success ?? false;
                    return false;
                };

                const permissions = {
                    canManageAdmin: isCurrentUserAdmin,
                    canImpersonate: getSuccess(impersonateResult),
                    canBan: getSuccess(banResult),
                };

                console.log('[UsersTable] Final permissions:', permissions);
                setPermissions(permissions);
            } catch (error) {
                console.error('Error checking permissions:', error);
                if (isMounted) {
                    setPermissions({
                        canManageAdmin: false,
                        canImpersonate: false,
                        canBan: false,
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
        [permissions.canManageAdmin, permissions.canImpersonate, permissions.canBan]
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

