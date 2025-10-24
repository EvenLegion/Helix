'use client';

import { MembersDataTable } from './members-data-table';
import { getMembersColumns, type Member } from './members-columns';
import type { OrganizationRole } from '@workspace/db';

export function MembersTable({
    members,
    organizationName,
    roles,
}: {
    members: Member[];
    organizationName?: string;
    roles: OrganizationRole[];
}) {
    const membersColumns = getMembersColumns(roles);

    return (
        <MembersDataTable columns={membersColumns} data={members} organizationName={organizationName} roles={roles} />
    );
}
