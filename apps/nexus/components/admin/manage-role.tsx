"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { statement } from '@/lib/auth/permissions';
import { Badge } from '@workspace/ui/components/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@workspace/ui/components/command';
import { Button } from '@workspace/ui/components/button';
import {
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
} from '@workspace/ui/components/field';
import {
    Select,
    SelectContent,
    SelectTrigger,
    SelectValue,
    SelectItem,
} from '@workspace/ui/components/select';
import { Loader2, Check, X, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@workspace/ui/components/collapsible';
import { Separator } from '@workspace/ui/components/separator';
import { cn } from '@workspace/ui/lib/utils';
import type { OrganizationRole } from '@workspace/db';
import { updateOrganizationRole, deleteOrganizationRole } from '@/server/organizations';

interface ManageRoleDialogProps {
    roles: OrganizationRole[];
}

// Define the schema for application and permissions
const applicationPermissionSchema = z.object({
    application: z.custom<keyof typeof statement>(),
    permissions: z.array(z.string()).min(1, 'Pick at least one permission'),
});

const formSchema = z.object({
    applicationPermissions: z.array(applicationPermissionSchema).min(1, 'At least one application is required'),
});

type FormValues = z.infer<typeof formSchema>;

export function ManageRoleDialog({ roles }: ManageRoleDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [applicationSelectOpen, setApplicationSelectOpen] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            applicationPermissions: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'applicationPermissions',
    });

    const { data: session } = authClient.useSession();
    const selectedRole = roles.find(r => r.id === selectedRoleId);

    // Load role data when selected
    useEffect(() => {
        if (selectedRole) {
            try {
                const parsed = JSON.parse(selectedRole.permission);
                const applicationPermissions = Object.entries(parsed).map(([application, permissions]) => ({
                    application: application as keyof typeof statement,
                    permissions: permissions as string[],
                }));
                form.reset({
                    applicationPermissions,
                });
            } catch (error) {
                console.error('Error parsing role permissions:', error);
                form.reset({
                    applicationPermissions: [],
                });
            }
        } else {
            form.reset({
                applicationPermissions: [],
            });
        }
    }, [selectedRole, form]);

    // Get already selected applications
    const selectedApplications = fields.map(field => field.application);

    // Get available applications (not yet selected)
    const availableApplications = (Object.keys(statement) as Array<keyof typeof statement>).filter(
        app => !selectedApplications.includes(app)
    );

    // Add new application
    const handleAddApplication = (application: keyof typeof statement) => {
        append({
            application,
            permissions: [],
        });
        setApplicationSelectOpen(false);
    };

    // Remove application
    const handleRemoveApplication = (index: number) => {
        remove(index);
    };

    // Toggle a permission for a specific application
    const togglePermission = (appIndex: number, permission: string) => {
        const currentPermissions = form.getValues(`applicationPermissions.${appIndex}.permissions`);
        const newPermissions = currentPermissions.includes(permission)
            ? currentPermissions.filter(p => p !== permission)
            : [...currentPermissions, permission];

        form.setValue(`applicationPermissions.${appIndex}.permissions`, newPermissions, {
            shouldValidate: true,
        });
    };

    // Select all permissions for a specific application
    const selectAllPermissions = (appIndex: number) => {
        const application = form.getValues(`applicationPermissions.${appIndex}.application`);
        const allPermissions = statement[application] as readonly string[];
        form.setValue(`applicationPermissions.${appIndex}.permissions`, [...allPermissions], {
            shouldValidate: true,
        });
    };

    // Clear all permissions for a specific application
    const clearAllPermissions = (appIndex: number) => {
        form.setValue(`applicationPermissions.${appIndex}.permissions`, [], {
            shouldValidate: true,
        });
    };

    async function onSubmit(values: FormValues) {
        const activeOrg = session?.session?.activeOrganizationId;

        if (!activeOrg) {
            toast.error('No active organization found');
            return;
        }

        if (!selectedRoleId) {
            toast.error('Please select a role to manage');
            return;
        }

        // Transform to the format expected by the API
        const permissions = values.applicationPermissions.reduce((acc, { application, permissions }) => {
            acc[application] = permissions;
            return acc;
        }, {} as Record<string, string[]>);

        try {
            setIsLoading(true);

            // Update role permissions using server action
            await updateOrganizationRole(selectedRoleId, activeOrg, permissions);

            toast.success('Role updated successfully');
            setOpen(false);
            setSelectedRoleId("");
            window.location.reload();
        } catch (error) {
            console.error('Full error object:', error);
            console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');

            toast.error(error instanceof Error ? error.message : 'Failed to update role');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleDeleteRole() {
        const activeOrg = session?.session?.activeOrganizationId;

        if (!activeOrg) {
            toast.error('No active organization found');
            return;
        }

        if (!selectedRoleId) {
            toast.error('Please select a role to delete');
            return;
        }

        try {
            setIsDeleting(true);

            // Delete role using server action
            await deleteOrganizationRole(selectedRoleId, activeOrg);

            toast.success('Role deleted successfully');
            setDeleteConfirmOpen(false);
            setOpen(false);
            setSelectedRoleId("");
            window.location.reload();
        } catch (error) {
            console.error('Full error object:', error);
            console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');

            toast.error(error instanceof Error ? error.message : 'Failed to delete role');
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
                Manage Roles
            </DialogTrigger>
            <DialogContent className="md:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Role</DialogTitle>
                    <DialogDescription>
                        Select a role to modify its permissions in the organization.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                    {/* Role Selection */}
                    <Field>
                        <FieldLabel>Select Role</FieldLabel>
                        <Select
                            value={selectedRoleId}
                            onValueChange={(value) => setSelectedRoleId(value || "")}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue>
                                    {selectedRole?.role || "Select a role to manage"}
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
                        <FieldDescription>Choose the role you want to manage.</FieldDescription>
                    </Field>

                    {/* Form for selected role */}
                    {selectedRole && (
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Add Application */}
                            <Field>
                                <FieldLabel>Applications</FieldLabel>
                                <Popover open={applicationSelectOpen} onOpenChange={setApplicationSelectOpen}>
                                    <PopoverTrigger render={
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full justify-start"
                                            disabled={availableApplications.length === 0}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Application
                                        </Button>
                                    } />
                                    <PopoverContent className="p-0 w-[300px]">
                                        <Command>
                                            <CommandInput placeholder="Search for an application..." />
                                            <CommandList>
                                                <CommandEmpty>No applications found.</CommandEmpty>
                                                <CommandGroup heading="Available Applications">
                                                    {availableApplications.map(app => (
                                                        <CommandItem
                                                            key={app}
                                                            onSelect={() => handleAddApplication(app)}
                                                        >
                                                            <Check className="mr-2 h-4 w-4 opacity-0" />
                                                            {app}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FieldDescription>Select applications to configure permissions for the role.</FieldDescription>
                            </Field>

                            {/* Application Permissions List */}
                            {fields.length > 0 && (
                                <div className="space-y-4">
                                    {fields.map((field, appIndex) => {
                                        const application = form.watch(`applicationPermissions.${appIndex}.application`);
                                        const permissions = form.watch(`applicationPermissions.${appIndex}.permissions`);
                                        const availablePermissions = statement[application] as readonly string[] | undefined;

                                        // Skip rendering if application is not in statement
                                        if (!availablePermissions) {
                                            return null;
                                        }

                                        const selectedPermissionsSet = new Set(permissions);
                                        const allSelected = permissions.length === availablePermissions.length;
                                        const someSelected = permissions.length > 0 && permissions.length < availablePermissions.length;

                                        return (
                                            <Collapsible key={field.id} defaultOpen className="border rounded-lg">
                                                <div className="relative">
                                                    <CollapsibleTrigger className="w-full">
                                                        <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[open]:rotate-180" />
                                                                <div className="flex-1 text-left">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-medium capitalize">{application}</span>
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            {permissions.length} / {availablePermissions.length}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CollapsibleTrigger>
                                                    {/* Remove button outside CollapsibleTrigger */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveApplication(appIndex);
                                                        }}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[disabled]:pointer-events-none disabled:opacity-50 flex items-center justify-center"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        <span className="sr-only">Remove</span>
                                                    </button>
                                                </div>
                                                <CollapsibleContent>
                                                    <div className="p-4 pt-0 space-y-4">
                                                        {/* Quick Actions */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => allSelected ? clearAllPermissions(appIndex) : selectAllPermissions(appIndex)}
                                                                    disabled={availablePermissions.length === 0}
                                                                >
                                                                    {allSelected ? 'Clear All' : 'Select All'}
                                                                </Button>
                                                            </div>
                                                            {someSelected && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {permissions.length} selected
                                                                </span>
                                                            )}
                                                        </div>

                                                        <Separator />

                                                        {/* Permissions Selection */}
                                                        <Popover>
                                                            <PopoverTrigger render={
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="w-full justify-between"
                                                                >
                                                                    <span>
                                                                        {permissions.length > 0
                                                                            ? `${permissions.length} permission${permissions.length > 1 ? 's' : ''} selected`
                                                                            : 'Select Permissions'}
                                                                    </span>
                                                                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                                                </Button>
                                                            } />
                                                            <PopoverContent className="p-0 w-[360px]">
                                                                <Command>
                                                                    <CommandInput placeholder="Search for a permission..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No permissions found.</CommandEmpty>
                                                                        <CommandGroup heading={application}>
                                                                            {availablePermissions.map((perm) => {
                                                                                const isSelected = selectedPermissionsSet.has(perm);
                                                                                return (
                                                                                    <CommandItem
                                                                                        key={perm}
                                                                                        onSelect={() => togglePermission(appIndex, perm)}
                                                                                    >
                                                                                        <Check
                                                                                            className={cn(
                                                                                                "mr-2 h-4 w-4",
                                                                                                isSelected ? 'opacity-100' : 'opacity-0'
                                                                                            )}
                                                                                        />
                                                                                        {perm}
                                                                                    </CommandItem>
                                                                                );
                                                                            })}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>

                                                        {/* Selected Permissions */}
                                                        {permissions.length > 0 && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {permissions.map((perm) => (
                                                                    <Badge
                                                                        key={perm}
                                                                        variant="secondary"
                                                                        className="px-2 py-1 cursor-pointer hover:bg-secondary/80"
                                                                        onClick={() => togglePermission(appIndex, perm)}
                                                                    >
                                                                        {perm}
                                                                        <X className="ml-1 h-3 w-3" />
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Error Display */}
                                                        {form.formState.errors.applicationPermissions?.[appIndex]?.permissions && (
                                                            <FieldError
                                                                errors={[
                                                                    form.formState.errors.applicationPermissions[appIndex]?.permissions!
                                                                ]}
                                                            />
                                                        )}
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Form-level error for applicationPermissions */}
                            {form.formState.errors.applicationPermissions?.root && (
                                <FieldError errors={[form.formState.errors.applicationPermissions.root]} />
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <Button type="submit" disabled={isLoading || isDeleting} className="flex-1">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        'Update Role'
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={isLoading || isDeleting}
                                    onClick={() => setDeleteConfirmOpen(true)}
                                    className="flex-1"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Role
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Role</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the role "{selectedRole?.role}"? This action cannot be undone.
                            {selectedRole && (
                                <span className="block mt-2 text-sm text-muted-foreground">
                                    Note: This role cannot be deleted if it is currently assigned to any members.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 justify-end mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirmOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteRole}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
