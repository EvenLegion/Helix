"use client"

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select";
import {
    Field,
    FieldLabel,
    FieldDescription,
} from '@workspace/ui/components/field';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import type { Organization } from '@workspace/db';
import { deleteOrganization } from '@/server/organizations';

interface RemoveOrganizationDialogProps {
    organizations: Organization[];
}

export function RemoveOrganizationDialog({ organizations }: RemoveOrganizationDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedOrgId, setSelectedOrgId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { data: activeOrg } = authClient.useActiveOrganization();

    const selectedOrg = organizations.find(org => org.id === selectedOrgId);

    const handleDelete = async () => {
        if (!selectedOrgId) {
            toast.error('Please select an organization to remove');
            return;
        }

        setIsLoading(true);
        try {
            // Delete the organization
            await deleteOrganization(selectedOrgId);

            // If we deleted the active organization, switch to another one or clear it
            if (activeOrg?.id === selectedOrgId) {
                const remainingOrgs = organizations.filter(org => org.id !== selectedOrgId);
                if (remainingOrgs.length > 0) {
                    await authClient.organization.setActive({
                        organizationId: remainingOrgs[0].id,
                    });
                    toast.success(`Organization deleted. Switched to ${remainingOrgs[0].name}`);
                } else {
                    // Clear active organization if it was the last one
                    // Note: better-auth might handle this automatically
                    toast.success('Organization deleted');
                }
            } else {
                toast.success('Organization deleted successfully');
            }

            setOpen(false);
            setSelectedOrgId("");
            router.refresh();
        } catch (error) {
            console.error('Failed to delete organization:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to delete organization');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="destructive" className="m-1 p-2" />}>
                Remove Organization
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Remove Organization</DialogTitle>
                    <DialogDescription>
                        Select an organization to delete. This action cannot be undone and will remove all members, roles, and invitations associated with it.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    <Field>
                        <FieldLabel>Select Organization</FieldLabel>
                        <Select
                            value={selectedOrgId}
                            onValueChange={(value) => setSelectedOrgId(value || "")}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue>
                                    {selectedOrg?.name || "Select an organization to remove"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {organizations.map((org) => (
                                    <SelectItem key={org.id} value={org.id}>
                                        {org.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldDescription>Choose the organization you want to delete.</FieldDescription>
                    </Field>

                    {selectedOrg && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                            <p className="text-sm font-semibold text-destructive mb-2">
                                Warning: This will permanently delete "{selectedOrg.name}"
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                <li>All members will be removed</li>
                                <li>All roles and permissions will be deleted</li>
                                <li>All invitations will be cancelled</li>
                                <li>This action cannot be undone</li>
                            </ul>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setOpen(false);
                                setSelectedOrgId("");
                            }}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!selectedOrgId || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Organization'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
