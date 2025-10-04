import { getOrganizations } from 'server/organizations'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { CreateOrganizationDialog } from '@/components/admin/create-organization-dialog'
import { CreateNewRoleDialog } from '@/components/admin/create-new-role'
import { ManageRoleDialog } from '@/components/admin/manage-role'
import { CreateRoleForm } from '@/components/forms/user/create-role-form'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
} from '@workspace/ui/components/card'
import { FilteredMembersTable } from '@/components/admin/filtered-members-table'
import ActiveOrg  from '@/components/admin/active-org'
import { prisma } from '@workspace/db'

export default async function Dashboard() {
    const userOrgs = await getOrganizations();
    const organizations = userOrgs?.Member?.map(member => member.organization) || [];

    // Fetch all members for these organizations
    const members = await prisma.member.findMany({
        where: {
            organizationId: {
                in: organizations.map(org => org.id)
            }
        },
        include: {
            user: true,
            organization: {
                include: {
                    OrganizationRole: true,
                }
            }
        }
    })

    console.log(members);

    // TODO: Make page uniformed create subpage for organizations and roles
    return (
        <>
        <div className="min-h-svh p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Active Organization</CardTitle>
                </CardHeader>
                <CardContent>
                    <ActiveOrg organizations={organizations}/>
                </CardContent>
                <CardFooter>
                    <CreateOrganizationDialog/>
                </CardFooter>
            </Card>
            <CreateNewRoleDialog />
            <ManageRoleDialog />
            <Card className="mt-8 w-full">
                <FilteredMembersTable allMembers={ members } />
            </Card>
        </div>
        </>
    )
}
