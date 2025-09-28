import { getCurrentUser } from '@/server/users'
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
import { CreateOrganizationForm } from '@/components/forms/user/create-organization-form'
import { CreateRoleForm } from '@/components/forms/user/create-role-form'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent
} from '@workspace/ui/components/card'
import { FilteredMembersTable } from '@/components/admin/filtered-members-table'
import ActiveOrg  from '@/components/admin/active-org'

export default async function Dashboard() {
    const userOrgs = await getOrganizations();
    const { currentUser } = await getCurrentUser();

    console.log(currentUser);

    const organizations = userOrgs?.Member?.map(member => member.organization) || [];

    // Include organizationId for filtering
    const allMembers = userOrgs?.Member?.map(member => ({
        userId: member.userId,
        role: member.role,
        organization: member.organization.name,
        organizationId: member.organization.id, // Add this for filtering
        joinedAt: member.createdAt.toISOString(),
    })) || [];

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
            <Dialog>
                <DialogTrigger asChild>
                    <Button className="mt-8">Create New Organization</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create New Organization</DialogTitle>
                        <DialogDescription>
                            Create a new organization to manage your projects and teams.
                        </DialogDescription>
                    </DialogHeader>
                    <CreateOrganizationForm />
                </DialogContent>
            </Dialog>
            <Dialog>
                <DialogTrigger asChild>
                    <Button className="mt-8 ml-4">Create Roles</Button>
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
            <Card className="mt-8 w-full">
                <FilteredMembersTable allMembers={allMembers} />
            </Card>
        </div>
        </>
    )
}
