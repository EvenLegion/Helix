'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { OrganizationRole } from '@workspace/db';
import { Badge } from '@workspace/ui/components/badge';
import { ArrowUpRight, UserCog, ArrowUpDown, Trash2, Loader2, Users } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@workspace/ui/components/dialog';
import { AddRoleForm } from '@/components/forms/user/add-role-form';
import { statement } from '@/lib/auth/permissions';
import { useState, useEffect } from 'react';
import { deleteMemberFromOrganization } from '@/server/organizations';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@workspace/ui/components/alert-dialog';


export type Member = {
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    username?: string;
    permissions: Array<{ category: string; permission: string }>;
    isAdmin?: boolean;
};

// Group permissions by category
const groupPermissions = (permissions: Array<{ category: string; permission: string }>) => {
    const grouped = permissions.reduce(
        (acc, { category, permission }) => {
            if (!acc[category]) acc[category] = [];
            acc[category].push(permission);
            return acc;
        },
        {} as Record<string, string[]>,
    );

    return grouped;
};

// Define colors for different roles
const roleColors: Record<string, string> = {
    owner: 'bg-[#760a0b] text-white border-[#760a0b]',
    administrator: 'bg-[#604d00] text-white border-[#604d00]',
    imperator: 'bg-[#303069] text-white border-[#303069]',
    recruiter: 'bg-[#35665c] text-white border-[#35665c]',
    admirallus: 'bg-[#a08000] text-white border-[#a08000]',
};

// Get expected permissions for a role
const getRolePermissions = (roleName: string, orgRoles: OrganizationRole[]): Array<{ category: string; permission: string }> => {
    const normalizedRole = roleName.toLowerCase().trim();

    // Handle owner role with hardcoded permissions
    if (normalizedRole === 'owner') {
        return Object.entries(statement).flatMap(([category, perms]) =>
            (perms as readonly string[]).map((perm) => ({
                category,
                permission: perm,
            })),
        );
    }

    // Look up role in orgRoles
    const orgRole = orgRoles.find(r => r.role.toLowerCase().trim() === normalizedRole);
    if (!orgRole) return [];

    try {
        const parsed = JSON.parse(orgRole.permission);
        return Object.entries(parsed).flatMap(([category, perms]) =>
            (perms as string[]).map((perm) => ({
                category,
                permission: perm,
            })),
        );
    } catch (error) {
        console.error('Error parsing permissions for role:', orgRole.role, error);
        return [];
    }
};

// Permissions button component
function PermissionsButton({ member, orgRoles }: { member: Member; orgRoles?: OrganizationRole[] }) {
    const totalPermissions = member.permissions.length;
    const roles = member.role.split(',').map((r) => r.trim());

    // Get permissions per role
    const rolePermissionsMap = roles.map((role) => {
        const expectedPerms = getRolePermissions(role, orgRoles || []);
        const expectedPermsSet = new Set(expectedPerms.map(p => `${p.category}:${p.permission}`));

        // Filter member permissions to only include those that match this role's expected permissions
        const rolePerms = member.permissions.filter(p =>
            expectedPermsSet.has(`${p.category}:${p.permission}`)
        );

        return {
            role,
            permissions: rolePerms,
            grouped: groupPermissions(rolePerms),
        };
    });

    return (
        <Dialog>
            <DialogTrigger render={<Button size="sm" variant="secondary" className="h-8" />}>
                {totalPermissions === 1 ? 'Permission' : 'Permissions'}{' '}
                {totalPermissions > 0 && (
                    <span className="ml-1">
                        <ArrowUpRight strokeWidth="4" />
                    </span>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Permissions for {member.username || member.userId}</DialogTitle>
                    <DialogDescription>Viewing permissions across all roles for this user</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                    {rolePermissionsMap.map(({ role, permissions, grouped }, roleIdx) => (
                        <div key={roleIdx} className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-sm capitalize ${roleColors[role.toLowerCase()] || ''}`}>
                                    {role}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
                                </Badge>
                            </div>
                            <div className="space-y-3 pl-4 border-l-2">
                                {Object.keys(grouped).length > 0 ? (
                                    Object.entries(grouped).map(([category, perms]) => (
                                        <div key={category} className="space-y-2">
                                            <div className="font-semibold text-sm capitalize text-muted-foreground">
                                                {category}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {perms.map((perm, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                        {perm}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground">No permissions assigned</div>
                                )}
                            </div>
                        </div>
                    ))}
                    {rolePermissionsMap.length === 0 && (
                        <div className="text-center text-muted-foreground py-4">
                            No roles assigned
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Role badge cell component
function RoleBadgeCell({ member, orgRoles, canUpdateRoles }: { member: Member; orgRoles?: OrganizationRole[]; canUpdateRoles: boolean }) {
    const roles = member.role.split(',').map((r) => r.trim());

    return (
        <div className="flex flex-wrap gap-1">
            {roles.map((role, idx) => (
                <Badge
                    key={idx}
                    variant="outline"
                    className={`text-xs capitalize leading-none ${roleColors[role] || ''}`}
                >
                    {role}
                </Badge>
            ))}
            <Dialog>
                {canUpdateRoles && <DialogTrigger nativeButton={false} render={<Badge variant="secondary" className="text-xs cursor-pointer" />}>
                    <UserCog strokeWidth={3} />
                </DialogTrigger>}
                <DialogContent className="md:max-w-lg">
                    <DialogTitle>Manage roles for user</DialogTitle>
                    <DialogDescription className="mb-4">
                        Select roles to assign to this user.
                    </DialogDescription>
                    <AddRoleForm roles={orgRoles || []} member={member} />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DeleteMemberButton({ member, canDelete }: { member: Member; canDelete: boolean }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    if (!canDelete) {
        return null;
    }

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteMemberFromOrganization(member.id);
            toast.success('Member deleted successfully');
            router.refresh();
        } catch (error) {
            console.error('Failed to delete member:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to delete member');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger render={
                <Button size="sm" variant="destructive" className="h-8" >
                    <Trash2 className="h-4 w-4" />
                </Button>
            } />
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Member</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to remove {member.username || member.userId} from the organization?
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isDeleting}
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting && <span className="mr-2"><Loader2 /></span>}
                        {isDeleting ? 'Removing...' : 'Remove Member'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function ImpersonateMemberButton({ member, canImpersonate }: { member: Member; canImpersonate: boolean }) {
    const [isImpersonating, setIsImpersonating] = useState(false);
    const router = useRouter();

    if (!canImpersonate) {
        return null;
    }

    const handleImpersonate = async () => {
        setIsImpersonating(true);
        try {
            const result = await authClient.admin.impersonateUser({
                userId: member.userId,
            });

            if ('error' in result && result.error) {
                toast.error(result.error.message || 'Failed to impersonate user');
                return;
            }

            toast.success(`Now impersonating ${member.username || member.userId}`);
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
            title={`Impersonate ${member.username || member.userId}`}
        >
            {isImpersonating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Users className="h-4 w-4" />
            )}
        </Button>
    );
}

export function getMembersColumns(
    roles: OrganizationRole[],
    permissions: { canUpdateRoles: boolean; canDelete: boolean; canImpersonate: boolean }
): ColumnDef<Member>[] {
    return [
        {
            accessorKey: 'userId',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        User ID
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div className="font-medium">{row.getValue('userId')}</div>,
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
            cell: ({ row }) => <div className="font-medium">{row.getValue('username') || row.original.userId}</div>,
        },
        {
            accessorKey: 'role',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Roles
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <RoleBadgeCell member={row.original} orgRoles={roles} canUpdateRoles={permissions.canUpdateRoles} />,
            filterFn: (row, id, value) => {
                return row.getValue<string>(id).toLowerCase().includes(value.toLowerCase());
            },
        },
        {
            id: 'permissions',
            accessorKey: 'permissions',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Permissions
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <PermissionsButton member={row.original} orgRoles={roles} />,
            filterFn: (row, id, value) => {
                const permissions = row.original.permissions;
                return permissions.some(
                    (p) =>
                        p.permission.toLowerCase().includes(value.toLowerCase()) ||
                        p.category.toLowerCase().includes(value.toLowerCase()),
                );
            },
        },
        {
            accessorKey: 'joinedAt',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Joined At
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => new Date(row.getValue('joinedAt')).toLocaleDateString(),
        },
        {
            accessorKey: 'actions',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Actions
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div className="flex flex-wrap gap-1">
                <DeleteMemberButton member={row.original} canDelete={permissions.canDelete} />
                <ImpersonateMemberButton member={row.original} canImpersonate={permissions.canImpersonate} />
            </div>
        }
    ];
}
