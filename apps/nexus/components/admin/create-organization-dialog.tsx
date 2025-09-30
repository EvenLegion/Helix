"use client";

import { useState } from "react";
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
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
                <CreateOrganizationForm onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
