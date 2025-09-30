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
import { CreateRoleForm } from '@/components/forms/user/create-role-form'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent
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
            <Card className="mt-8 w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Active Organization</CardTitle>
                </CardHeader>
                <CardContent>
                    <ActiveOrg organizations={organizations}/>
                </CardContent>
            </Card>
            <CreateOrganizationDialog />
            <Dialog>
                <DialogTrigger asChild>
                    <Button className="mt-8 ml-4">Create New Role</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create New Role</DialogTitle>
                        <DialogDescription>
                            Create a new role to manage permissions within your organization.
                        </DialogDescription>
                    </DialogHeader>
                    <CreateRoleForm />
                </DialogContent>
            </Dialog>
            <Dialog>
                <DialogTrigger asChild>
                    <Button className="mt-8 ml-4">Manage Roles</Button>
                </DialogTrigger>
                <DialogContent className="md:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Manage Role</DialogTitle>
                        <DialogDescription>
                            Manage a role to modify their permissions in the organization.
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
            <Card className="mt-8 w-full">
                <FilteredMembersTable allMembers={ members } />
            </Card>
        </div>
        </>
    )
}
