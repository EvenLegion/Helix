import { getOrganizations } from 'server/organizations';
import { CreateOrganizationDialog } from '@/components/admin/create-organization-dialog';
import { CreateNewRoleDialog } from '@/components/admin/create-new-role';
import { ManageRoleDialog } from '@/components/admin/manage-role';
import { AddUserDialog } from '@/components/admin/add-user-dialog';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@workspace/ui/components/card';
import { FilteredMembersTable } from '@/components/admin/filtered-members-table';
import { OrganizationManagementPanel } from '@/components/admin/organization-management-panel';
import { MemberDAL } from '@/dal/members';
import { RoleDAL } from '@/dal/roles';
import { checkPermissionsOrAdmin } from '@/server/permissions';

export default async function Organizations() {
    // Check if user is admin or has permission to view organizations
    const canViewOrganizations = await checkPermissionsOrAdmin({
        member: ['read'],
    });

    if (!canViewOrganizations) {
        return (
            <div className="min-h-svh p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have permission to view this page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const userOrgs = await getOrganizations();
    const organizations = userOrgs?.Member?.map((member) => member.organization) || [];

    // Fetch all members for these organizations
    const allMembers = await MemberDAL.findByOrganizationIds(organizations.map((org) => org.id));

    // Filter out orphaned members (where user doesn't exist)
    const members = allMembers.filter((member) => member.user !== null);

    const roles = await RoleDAL.findByOrganizationIds(organizations.map((org) => org.id));

    // Check permissions using the helper function
    // Site admins bypass organization-level permissions
    const canCreateRoles = await checkPermissionsOrAdmin({
        ac: ['create'],
    });

    const canUpdateRoles = await checkPermissionsOrAdmin({
        ac: ['update'],
    });

    const canAddMembers = await checkPermissionsOrAdmin({
        member: ['create'],
    });

    const isOwner = await checkPermissionsOrAdmin({
        organization: ['owner'],
    });

    return (
        <>
            <div className="min-h-svh p-4">
                {isOwner && <OrganizationManagementPanel />}
                <div className="flex gap-2 mt-2 ml-4">
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
