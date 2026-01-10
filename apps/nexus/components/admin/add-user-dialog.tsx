"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Button } from '@workspace/ui/components/button';
import { AddUserForm } from '@/components/forms/user/add-user-form';
import type { OrganizationRole } from '@workspace/db';
import { UserPlus } from 'lucide-react';

interface AddUserDialogProps {
    roles: OrganizationRole[];
}

export function AddUserDialog({ roles }: AddUserDialogProps) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const handleSuccess = () => {
        setOpen(false);
        router.refresh();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
                <UserPlus className="size-4 mr-2" />
                Add User to Organization
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add User to Organization</DialogTitle>
                    <DialogDescription>
                        Search for a user by email, username, or nickname and add them to the active organization with a role.
                    </DialogDescription>
                </DialogHeader>
                <AddUserForm onSuccess={handleSuccess} roles={roles} />
            </DialogContent>
        </Dialog>
    );
}
