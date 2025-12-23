"use client";

import { authClient } from "@/lib/auth-client";
import { MembersTable } from '@/components/admin/members-table';
import type { Member, User, Organization, OrganizationRole } from '@workspace/db'
import { statement } from '@/lib/auth/permissions';

type AllMembers = Member & {
    user: User,
    organization: Organization & {
        OrganizationRole: OrganizationRole[];
    }
}

interface FilteredMembersTableProps {
    allMembers: AllMembers[]
    roles: OrganizationRole[];
}

// Normalize common role name variations/typos
const normalizeRoleName = (role: string): string => {
    const normalized = role.toLowerCase().trim();
    // Handle common typos
    if (normalized === 'recuriter') return 'recruiter';
    return normalized;
};

// Hardcoded permissions for the owner role (from lib/auth/permissions.ts)
const getOwnerPermissions = () => {
    return Object.entries(statement).flatMap(([category, perms]) =>
        (perms as readonly string[]).map((perm) => ({
            category,
            permission: perm,
        })),
    );
};

export function FilteredMembersTable({ allMembers, roles }: FilteredMembersTableProps) {
    const { data: activeOrg } = authClient.useActiveOrganization();

    // Filter members by active organization
    const filteredMembers = allMembers.filter(member =>
        member.organizationId === activeOrg?.id
    );

    // Transform to match MembersTable interface (remove organizationId and organization fields)
    const membersForTable = filteredMembers.map(member => {
        const memberRoles = member.role.split(',').map((r) => normalizeRoleName(r));

        // Check if member has owner role
        const hasOwnerRole = memberRoles.includes('owner');

        // Get roles for this organization
        const rolesForThisOrg = roles.filter(r => r.organizationId === member.organizationId);

        // Filter organization roles that match the member's organization and roles
        const matchingOrgRoles = rolesForThisOrg.filter((orgRole) => {
            const normalizedOrgRole = normalizeRoleName(orgRole.role);
            return memberRoles.includes(normalizedOrgRole);
        });

        // Extract permissions from matching roles
        let permissions = matchingOrgRoles.flatMap((orgRole) => {
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
                console.error('Error parsing permissions for role:', orgRole.role, error);
                return [];
            }
        });

        // If member has owner role, add owner permissions (they override/can be merged)
        if (hasOwnerRole) {
            const ownerPermissions = getOwnerPermissions();
            // Merge owner permissions with existing permissions, avoiding duplicates
            const existingPerms = new Set(permissions.map(p => `${p.category}:${p.permission}`));
            const uniqueOwnerPerms = ownerPermissions.filter(
                p => !existingPerms.has(`${p.category}:${p.permission}`)
            );
            permissions = [...permissions, ...uniqueOwnerPerms];
        }

        return {
            id: member.id,
            userId: member.userId,
            role: member.role,
            joinedAt: member.createdAt.toISOString(),
            username: member.user.nickname || member.user.username || undefined,
            permissions,
        };
    });

    return <MembersTable members={membersForTable} roles={roles} />;
}
