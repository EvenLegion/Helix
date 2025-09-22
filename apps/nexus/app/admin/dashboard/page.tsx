
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { CreateOrganizationForm } from 'components/forms/create-organization-form'
import { getOrganizations } from 'server/organizations'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent
} from '@workspace/ui/components/card'
import { MembersTable } from '@/components/admin/members-table'

export default async function Dashboard() {
    const userOrgs = await getOrganizations();

    // List organizations the user is a member of
    userOrgs.Member.forEach((member) => {
        console.log(member.organization.name)
    })

    console.log("User Orgs:", userOrgs)

    // TODO: Make page uniformed create subpage for organizations and roles
    return (
        <>
        <div className="min-h-svh p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Welcome!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        This is your admin dashboard. Here you can manage your organizations, roles, and members.
                    </p>
                </CardContent>
            </Card>
            <Card className="mt-8 w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Your Organizations</CardTitle>
                </CardHeader>
                <CardContent>
                    {userOrgs?.Member.map((member) => (
                        <div key={member.organization.id} className="mb-4">
                            <h3 className="text-lg font-medium">{member.organization.name}</h3>
                            <p className="text-sm text-muted-foreground">Role: {member.role}</p>
                        </div>
                    ))}
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
            <Card className="mt-8 w-full">
                <MembersTable members={userOrgs?.Member?.map(member => ({
                    id: member.userId,
                    email: member.userId || 'No Email',
                    role: member.role,
                    joinedAt: member.createdAt.toISOString(),
                })) || []} />
            </Card>
        </div>
        </>
    )
}
