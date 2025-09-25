"use client";

import { authClient } from "@/lib/auth-client";
import { MembersTable } from '@/components/admin/members-table';

interface Member {
    userId: string;
    role: string;
    organization: string;
    organizationId: string;
    joinedAt: string;
}

interface FilteredMembersTableProps {
    allMembers: Member[];
}

export function FilteredMembersTable({ allMembers }: FilteredMembersTableProps) {
    const { data: activeOrg } = authClient.useActiveOrganization();

    // Filter members by active organization
    const filteredMembers = allMembers.filter(member =>
        member.organizationId === activeOrg?.id
    );

    // Transform to match MembersTable interface (remove organizationId and organization fields)
    const membersForTable = filteredMembers.map(member => ({
        id: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
    }));

    return <MembersTable members={membersForTable} />;
}
