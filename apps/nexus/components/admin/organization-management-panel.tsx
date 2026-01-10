import { unstable_noStore as noStore } from 'next/cache';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@workspace/ui/components/card';
import ActiveOrg from '@/components/admin/active-org';
import { RemoveOrganizationDialog } from '@/components/admin/remove-organization-dialog';
import { ManageOrganizationDialog } from '@/components/admin/manage-organization-dialog';
import { CreateOrganizationDialog } from '@/components/admin/create-organization-dialog';
import { getOrganizations } from '@/server/organizations';
import { checkPermissionsOrAdmin } from '@/server/permissions';

export async function OrganizationManagementPanel(): Promise<JSX.Element> {
    noStore();
    const userOrgs = await getOrganizations();
    const organizations = userOrgs?.Member?.map((member) => member.organization) || [];
    const [canCreateOrganizations, canDeleteOrganizations, canUpdateOrganizations] = await Promise.all([
        checkPermissionsOrAdmin({ organization: ['create'] }),
        checkPermissionsOrAdmin({ organization: ['delete'] }),
        checkPermissionsOrAdmin({ organization: ['update'] }),
    ]);

    return (
        <Card className="w-full max-w-1/2 mb-4">
            <CardHeader>
                <CardTitle>Active Organization</CardTitle>
            </CardHeader>
            <CardContent>
                <ActiveOrg
                    organizations={organizations}
                    key={JSON.stringify(organizations.map(o => ({ id: o.id, isRecruiting: o.isRecruiting })))}
                />
            </CardContent>
            <CardFooter>
                {canCreateOrganizations && <CreateOrganizationDialog />}
                {canUpdateOrganizations && organizations.length > 0 && (
                    <ManageOrganizationDialog organizations={organizations} />
                )}
                {organizations.length > 1 && canDeleteOrganizations && (
                    <RemoveOrganizationDialog organizations={organizations} />
                )}
            </CardFooter>
        </Card>
    );
}
