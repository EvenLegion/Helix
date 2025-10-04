"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
}   from '@workspace/ui/components/dialog';
import { Button } from '@workspace/ui/components/button';

import { useState } from "react";

export function ManageRoleDialog() {
    const [open, setOpen] = useState(false);

    return (
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
    );
}
