'use client';

import { useState, useEffect } from 'react';
import { Button } from '@workspace/ui/components/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Switch } from '@workspace/ui/components/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select';
import { toast } from 'sonner';
import { updateOrganization } from '@/server/organizations';
import { Settings, Loader2, Check } from 'lucide-react';
import { organization } from 'better-auth/plugins/organization';
import { useRouter } from 'next/navigation';

interface ManageOrganizationDialogProps {
    organizations: Array<{
        id: string;
        name: string;
        slug: string;
        isRecruiting: boolean;
    }>;
}

export function ManageOrganizationDialog({ organizations }: ManageOrganizationDialogProps) {
    const [open, setOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [isRecruiting, setIsRecruiting] = useState(false);
    const router = useRouter();

    // When org selection is changed to populate fields
    useEffect(() => {
        if (selectedOrgId) {
            const org = organizations.find((org) => org.id === selectedOrgId);
            if (org) {
                setName(org.name);
                setSlug(org.slug);
                setIsRecruiting(org.isRecruiting);
            }
        } else {
            setName('');
            setSlug('');
            setIsRecruiting(false);
        }
    }, [selectedOrgId, organizations]);

    const handleSave = async () => {
        if (!selectedOrgId) {
            toast.error('Please select an organization to manage.');
            return;
        }

        if (!name.trim()) {
            toast.error('Organization name cannot be empty.');
            return;
        }

        if (!slug.trim()) {
            toast.error('Organization slug cannot be empty.');
            return;
        }

        // Validate slug format
        const slugRegex = /^[a-z0-9-]+$/;
        if (!slugRegex.test(slug.trim())) {
            toast.error('Slug can only contain lowercase letters, numbers, and hyphens.');
            return;
        }

        setIsProcessing(true);
        try {
            await updateOrganization({
                organizationId: selectedOrgId,
                name: name.trim(),
                slug: slug.trim().toLowerCase(),
                isRecruiting,
            });

            toast.success('Organization updated successfully.');
            setOpen(false);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update organization.');
        } finally {
            setIsProcessing(false);
        }
    };

    const resetDialog = () => {
        setSelectedOrgId('');
        setName('');
        setSlug('');
        setIsRecruiting(false);
    };

    const handleCancel = () => {
        resetDialog();
        setOpen(false);
    };

    const selectedOrg = organizations.find((org) => org.id === selectedOrgId);

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (!isOpen) {
                    resetDialog();
                }
            }}
        >
            <DialogTrigger render={<Button variant="outline" className="m-1" />}>
                <Settings className="mr-2 h-4 w-4" />
                Manage Organization
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Manage Organization</DialogTitle>
                    <DialogDescription>Update organization details and recruiting status.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-select">Select Organization</Label>
                        <Select
                            value={selectedOrgId}
                            onValueChange={(value) => setSelectedOrgId(value || '')}
                            disabled={isProcessing}
                        >
                            <SelectTrigger id="org-select">
                                <SelectValue>{selectedOrg?.name || 'Select an organization'}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {organizations.map((org) => (
                                    <SelectItem key={org.id} value={org.id}>
                                        {org.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input
                            id="org-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter organization name"
                            disabled={isProcessing}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="org-slug">Organization Slug</Label>
                        <Input
                            id="org-slug"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder="Enter organization slug"
                            disabled={isProcessing}
                        />
                        <p className="text-sm text-muted-foreground">
                            Used in URLs. Should be lowercase with only letters, numbers, and hyphens.
                        </p>
                    </div>

                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                        <div className="flex-1 space-y-0.5">
                            <Label htmlFor="is-recruiting" className="text-base font-medium">
                                Actively Recruiting
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Allow users to submit recruitment applications to this organization.
                            </p>
                        </div>
                        <Switch
                            id="is-recruiting"
                            checked={isRecruiting}
                            onCheckedChange={setIsRecruiting}
                            disabled={isProcessing}
                        ></Switch>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleCancel} disabled={isProcessing} variant="outline">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
