

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

export default async function Dashboard() {
    const userOrgs = await getOrganizations()

    // List organizations the user is a member of
    userOrgs.Member.forEach((member) => {
        console.log(member.organization.name)
    })

    // TODO: Make page uniformed create subpage for organizations and roles
    return (
        <>
        <Dialog>
            <DialogTrigger asChild>
                <Button>Create Organization</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                        Create a new organization to collaborate with your team.
                    </DialogDescription>
                </DialogHeader>
                <CreateOrganizationForm />
            </DialogContent>
        </Dialog>
        </>
    )
}
