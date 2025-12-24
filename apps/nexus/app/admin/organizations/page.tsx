import { getOrganizations } from 'server/organizations';
import { CreateOrganizationDialog } from '@/components/admin/create-organization-dialog';
import { CreateNewRoleDialog } from '@/components/admin/create-new-role';
import { ManageRoleDialog } from '@/components/admin/manage-role';
import { AddUserDialog } from '@/components/admin/add-user-dialog';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@workspace/ui/components/card';
import { FilteredMembersTable } from '@/components/admin/filtered-members-table';
import ActiveOrg from '@/components/admin/active-org';
import { RemoveOrganizationDialog } from "@/components/admin/remove-organization-dialog";
import { MemberDAL } from '@/dal/members';
import { RoleDAL } from '@/dal/roles';
import { checkPermissions } from '@/server/permissions';

export default async function Organizations() {
    const userOrgs = await getOrganizations();
    const organizations = userOrgs?.Member?.map((member) => member.organization) || [];

    // Fetch all members for these organizations
    const members = await MemberDAL.findByOrganizationIds(
        organizations.map((org) => org.id)
    );

    const roles = await RoleDAL.findByOrganizationIds(
        organizations.map((org) => org.id)
    );

    // Check permissions using the helper function
    const canCreateRoles = await checkPermissions({
        ac: ['create']
    });

    const canUpdateRoles = await checkPermissions({
        ac: ['update']
    });

    const canAddMembers = await checkPermissions({
        member: ['create']
    });

    const canCreateOrganizations = await checkPermissions({
        organization: ['create']
    });

    const canDeleteOrganizations = await checkPermissions({
        organization: ['delete']
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
                        {canCreateOrganizations && <CreateOrganizationDialog />}
                        {organizations.length > 1 && canDeleteOrganizations && <RemoveOrganizationDialog organizations={organizations} />}
                    </CardFooter>
                </Card>
                <div className="flex gap-2 mt-8 ml-4">
                    {canCreateRoles && <CreateNewRoleDialog />}
                    {canUpdateRoles && <ManageRoleDialog roles={roles} />}
                    {canAddMembers && <AddUserDialog roles={roles} />}
                </div>
                <Card className="mt-4 w-full">
                    <FilteredMembersTable allMembers={members} roles={roles} />
                </Card>
            </div>
        </>
    );
}

