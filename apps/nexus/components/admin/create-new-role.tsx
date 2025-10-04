"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { CreateRoleForm } from "@/components/forms/user/create-role-form";

import { useState } from "react";

export function CreateNewRoleDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="mt-9 ml-4">Create New Role</Button>
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
    )
