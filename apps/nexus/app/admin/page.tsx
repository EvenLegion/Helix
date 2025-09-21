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

export default async function Dashboard() {
    const userOrgs = await getOrganizations()

    // List organizations the user is a member of
    userOrgs.Member.forEach((member) => {
        console.log(member.organization.name)
    })

    // TODO: Make page uniformed create subpage for organizations and roles
    return (
        <>
        <div className="min-h-svh p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Card Title</CardTitle>
                </CardHeader>
            </Card>
        </div>
        </>
    )
}
