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
import {
    Select,
    SelectContent,
    SelectTrigger,
    SelectValue,
    SelectItem
} from '@workspace/ui/components/select';

import {JSX, useState} from "react";
import { authClient } from '@/lib/auth-client';
import type { OrganizationRole } from '@workspace/db';
import {role} from "better-auth/client";

interface ManageRoleDialogProps {
    roles: OrganizationRole[];
}

export function ManageRoleDialog({ roles }: ManageRoleDialogProps ) {
    const [open, setOpen] = useState(false);
    const [roleSelected, setRoleSelected] = useState<string>("");
    const [permissions, setPermissions] = useState<string[]>([]);

    const handleRoleChange = (roleId: string | null) => {
        if (!roleId) return;
        setRoleSelected(roleId);

    }

    const roleSelectedName = roles.find(role => role.id == roleSelected)?.role;
    return (
            <Dialog>
                <DialogTrigger render={<Button className="mt-8 ml-4" />}>
                    Manage Roles
                </DialogTrigger>
                <DialogContent className="md:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Manage Role</DialogTitle>
                        <DialogDescription>
                            Manage a role to modify their permissions in the organization.
                        </DialogDescription>
                    </DialogHeader>
                    <Select onValueChange={handleRoleChange} value={roleSelected}>
                        <SelectTrigger className="w-full">
                            <SelectValue>
                                {roleSelectedName ||"Select a role to manage"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                    {role.role}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </DialogContent>
            </Dialog>
    );
}
