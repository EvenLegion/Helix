'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { OrganizationRole } from '@workspace/db';
import { Badge } from '@workspace/ui/components/badge';
import { ArrowUpRight, UserCog } from 'lucide-react';
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
import { ArrowUpDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { statement } from '@/lib/auth/permissions';

export type Member = {
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    username?: string;
    permissions: Array<{ category: string; permission: string }>;
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
function RoleBadgeCell({ member, orgRoles }: { member: Member; orgRoles?: OrganizationRole[] }) {
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
                <DialogTrigger nativeButton={false} render={<Badge variant="secondary" className="text-xs cursor-pointer" />}>
                    <UserCog strokeWidth={3} />
                </DialogTrigger>
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

export function getMembersColumns(roles: OrganizationRole[]): ColumnDef<Member>[] {
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
            cell: ({ row }) => <RoleBadgeCell member={row.original} orgRoles={roles} />,
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
    ];
}
