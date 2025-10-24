'use client';

import { authClient } from '@/lib/auth-client';
import { MembersTable } from '@/components/admin/members-table';
import type { Member, User, Organization, OrganizationRole } from '@workspace/db';

type AllMembers = Member & {
    user: User;
    organization: Organization & {
        OrganizationRole: OrganizationRole[];
    };
};

interface FilteredMembersTableProps {
    allMembers: AllMembers[];
    roles: OrganizationRole[];
}

export function FilteredMembersTable({ allMembers, roles }: FilteredMembersTableProps) {
    const { data: activeOrg } = authClient.useActiveOrganization();

    // Filter members by active organization
    const filteredMembers = allMembers.filter((member) => member.organizationId === activeOrg?.id);

    // Transform to match MembersTable interface (remove organizationId and organization fields)
    const membersForTable = filteredMembers.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.createdAt.toISOString(),
        username: member.user.nickname || member.user.username || undefined,
        permissions: member.organization.OrganizationRole.filter((orgRole) => {
            // Accounting for multiple roles
            const memberRoles = member.role.split(',').map((r) => r.trim());
            return memberRoles.includes(orgRole.role);
        }).flatMap((orgRole) => {
            try {
                const parsed = JSON.parse(orgRole.permission);
                // Convert to array of objects with category and permission
                return Object.entries(parsed).flatMap(([category, perms]) =>
                    (perms as string[]).map((perm) => ({
                        category,
                        permission: perm,
                    })),
                );
            } catch (error) {
                console.error('Error parsing permissions:', error);
                return [];
            }
        }),
    }));

    console.log('Permission Members:', membersForTable);

    return <MembersTable members={membersForTable} organizationName={activeOrg?.name} roles={roles} />;
}
