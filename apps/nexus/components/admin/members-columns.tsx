'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { OrganizationRole } from '@workspace/db';
import { Badge } from '@workspace/ui/components/badge';
import { ArrowUpRight } from 'lucide-react';
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
import { X, ArrowUpDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
};

// Permissions button component
function PermissionsButton({ member }: { member: Member }) {
    const groupedPerms = groupPermissions(member.permissions);
    const totalPermissions = member.permissions.length;
    const roles = member.role.split(',').map((r) => r.trim());

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="h-8">
                    {totalPermissions === 1 ? 'Permission' : 'Permissions'}{' '}
                    {totalPermissions > 0 && (
                        <span className="ml-1">
                            <ArrowUpRight strokeWidth="4" />
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Permissions for {member.username || member.userId}</DialogTitle>
                    <DialogDescription>Viewing permissions across all roles for this user</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                    {roles.map((role, roleIdx) => {
                        // Filter permissions by role if needed, for now showing all
                        return (
                            <div key={roleIdx} className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-sm capitalize ${roleColors[role] || ''}`}>
                                        {role}
                                    </Badge>
                                </div>
                                <div className="space-y-3 pl-4 border-l-2">
                                    {Object.entries(groupedPerms).map(([category, perms]) => (
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
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Role badge cell component
function RoleBadgeCell({ member, orgRoles }: { member: Member; orgRoles?: OrganizationRole[] }) {
    const router = useRouter();
    const { data: session } = authClient.useSession();
    const [roleToRemove, setRoleToRemove] = useState<{ memberId: string; role: string } | null>(null);

    const roles = member.role.split(',').map((r) => r.trim());
    console.log('Member roles:', member);

    const handleRemoveRole = async (memberId: string, role: string) => {
        const currentRoles = member.role.split(',').map((r) => r.trim());
        const updatedRoles = currentRoles.filter((r) => r !== role).join(', ');

        if (updatedRoles.length === 0) {
            try {
                const { data, error } = await authClient.organization.removeMember({
                    memberIdOrEmail: memberId,
                    organizationId: session?.session?.activeOrganizationId as string,
                });
                if (error) {
                    console.error('Failed to remove member:', error);
                    return;
                }
                console.log('Member removed successfully:', data);
            } catch (error) {
                console.error('Failed to remove member:', error);
                return;
            }
            router.refresh();
            setRoleToRemove(null);
            return;
        }

        try {
            const { data, error } = await authClient.organization.updateMemberRole({
                role: updatedRoles,
                memberId: memberId,
                organizationId: session?.session?.activeOrganizationId as string,
            });

            if (error) {
                console.error('Failed to remove role:', error);
                return;
            }
            console.log('Role removed successfully:', data);
        } catch (error) {
            console.error('Failed to remove role:', error);
            return;
        }

        router.refresh();
        setRoleToRemove(null);
    };

    return (
        <>
            <div className="flex flex-wrap gap-1">
                {roles.map((role, idx) => (
                    <Badge
                        key={idx}
                        variant="outline"
                        className={`text-xs flex items-center gap-1 pr-1 capitalize leading-none ${roleColors[role]}`}
                    >
                        <div className="flex items-center leading-none">{role}</div>
                        <button
                            onClick={() => setRoleToRemove({ memberId: member.id, role })}
                            className="text-muted-foreground transition-colors hover:bg-destructive rounded-full p-0.5 flex items-center justify-center"
                        >
                            <X color="white" className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
                <Dialog>
                    <DialogTrigger asChild>
                        <Badge variant="secondary" className="text-xs cursor-pointer">
                            +
                        </Badge>
                    </DialogTrigger>
                    <DialogContent className="md:max-w-lg">
                        <DialogTitle>Add role(s) to the user</DialogTitle>
                        <DialogDescription className="mb-4">
                            Assign additional roles to the user by selecting from the list below.
                        </DialogDescription>
                        <AddRoleForm roles={orgRoles || []} member={member} />
                    </DialogContent>
                </Dialog>
            </div>
            <Dialog open={!!roleToRemove} onOpenChange={(open) => !open && setRoleToRemove(null)}>
                <DialogContent className="md:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Remove Role</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove the role {roleToRemove?.role} from this user? This action
                            cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setRoleToRemove(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => roleToRemove && handleRemoveRole(roleToRemove.memberId, roleToRemove.role)}
                        >
                            Remove Role
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
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
            cell: ({ row }) => <PermissionsButton member={row.original} />,
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
