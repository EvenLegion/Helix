"use client";

import { MembersDataTable } from "./members-data-table";
import { membersColumns, type Member } from "./members-columns";

export function MembersTable({
    members,
    organizationName,
}: {
    members: Member[];
    organizationName?: string;
}) {
    return <MembersDataTable columns={membersColumns} data={members} organizationName={organizationName} />;
}
