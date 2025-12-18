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
import { CreateOrganizationForm } from '@/components/forms/user/create-organization-form';

export function CreateOrganizationDialog() {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const handleSuccess = () => {
        setOpen(false);
        router.refresh();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="p-2">Create New Organization</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription>
                        Create a new organization to manage your projects and teams.
                    </DialogDescription>
                </DialogHeader>
                <CreateOrganizationForm onSuccess={handleSuccess} />
            </DialogContent>
        </Dialog>
    );
}
