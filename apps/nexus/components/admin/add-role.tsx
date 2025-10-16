import { Badge } from '@workspace/ui/components/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@workspace/ui/components/dialog';
import { AddRoleForm } from "@/components/forms/user/add-role"; 

export function AddRole() {

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Badge variant="secondary" className="text-xs cursor-pointer">
                    +
                </Badge>
            </DialogTrigger>
            <DialogContent className="md:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add Role</DialogTitle>
                    <DialogDescription>
                        Add a role to the user in the organization.
                    </DialogDescription>
                </DialogHeader>
                <AddRoleForm />
            </DialogContent>
            </Dialog>
    )
}
