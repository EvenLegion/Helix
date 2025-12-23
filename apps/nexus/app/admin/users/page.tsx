'use server';

import { getOrganizations } from 'server/organizations';
import { CreateOrganizationDialog } from '@/components/admin/create-organization-dialog';
import { CreateNewRoleDialog } from '@/components/admin/create-new-role';
import { ManageRoleDialog } from '@/components/admin/manage-role';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@workspace/ui/components/card';
import { FilteredMembersTable } from '@/components/admin/filtered-members-table';
import ActiveOrg from '@/components/admin/active-org';
import { prisma } from '@workspace/db';
import {RemoveOrganizationDialog} from "@/components/admin/remove-organization-dialog";

export default async function Users() {
    const userOrgs = await getOrganizations();
    const organizations = userOrgs?.Member?.map((member) => member.organization) || [];

    // Fetch all members for these organizations
    const members = await prisma.member.findMany({
        where: {
            organizationId: {
                in: organizations.map((org) => org.id),
            },
        },
        include: {
            user: true,
            organization: {
                include: {
                    OrganizationRole: true,
                },
            },
        },
    });

    const roles = await prisma.organizationRole.findMany({
        where: {
            organizationId: {
                in: organizations.map((org) => org.id),
            },
        },
    });

    return (
        <>
            <div className="min-h-svh p-4">
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle>Active Organization</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ActiveOrg organizations={organizations} />
                    </CardContent>
                    <CardFooter>
                        <CreateOrganizationDialog />
                        {organizations.length > 1 && <RemoveOrganizationDialog />}
                    </CardFooter>
                </Card>
                <CreateNewRoleDialog />
                <ManageRoleDialog roles={roles}/>
                <Card className="mt-8 w-full">
                    <FilteredMembersTable allMembers={members} roles={roles} />
                </Card>
            </div>
        </>
    );
}
