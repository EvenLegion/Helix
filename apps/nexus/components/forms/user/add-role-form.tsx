'use client';
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
    FieldTitle,
} from '@workspace/ui/components/field';
import { Button } from '@workspace/ui/components/button';
import { Checkbox } from '@workspace/ui/components/checkbox';

import type { OrganizationRole } from '@workspace/db';
import type { Member } from '@/components/admin/members-columns';
import { authClient } from '@/lib/auth-client';
import { useState, useEffect } from 'react';
import { updateSelfMemberRole } from '@/server/organizations';
import { toast } from 'sonner';

interface AddRoleFormProps {
    roles: OrganizationRole[];
    member: Member;
}

export function AddRoleForm({ roles, member }: AddRoleFormProps) {
    // Initialize with currently assigned roles
    const [selectedRoles, setSelectedRoles] = useState<string[]>(() => {
        if (member.role) {
            return member.role.split(',').map((r) => r.trim());
        }
        return [];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSelfUpdate, setIsSelfUpdate] = useState(false);

    // Detect if this is a self-update
    useEffect(() => {
        async function checkSelf() {
            const { data: session } = await authClient.getSession();
            setIsSelfUpdate(session?.user.id === member.userId);
        }
        checkSelf();
    }, [member.userId]);

    const toggleRole = (roleName: string) => {
        setSelectedRoles((prev) =>
            prev.includes(roleName) ? prev.filter((name) => name !== roleName) : [...prev, roleName],
        );
    };

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();

        setIsLoading(true);
        try {
            // Get active organization from session
            const { data: session } = await authClient.getSession();

            if (!session?.session.activeOrganizationId) {
                throw new Error('No active organization found in session');
            }

            // Filter to only include roles that exist in the organization
            // Note: "owner" is a special built-in role that doesn't exist in the database
            const validRoles = selectedRoles.filter((roleName) =>
                roleName === 'owner' || roles.some((role) => role.role === roleName)
            );

            // Use different endpoint based on whether this is a self-update
            if (isSelfUpdate) {
                // Use new server action for self-assignment
                await updateSelfMemberRole(
                    session.session.activeOrganizationId,
                    validRoles
                );
            } else {
                // Use existing better-auth API for updating other users
                await authClient.organization.updateMemberRole({
                    role: validRoles,
                    memberId: member.id,
                    organizationId: session.session.activeOrganizationId,
                });
            }

            window.location.reload();
        } catch (error) {
            console.error('Failed to update roles:', error);

            // Provide helpful error messages
            let errorMessage = 'Failed to update roles';
            if (error instanceof Error) {
                if (error.message.includes('owner role')) {
                    errorMessage = 'You cannot remove the owner role from yourself.';
                } else if (error.message.includes('does not exist')) {
                    errorMessage = 'One or more selected roles are invalid.';
                } else {
                    errorMessage = error.message;
                }
            }

            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit}>
            <FieldSet>
                <FieldLegend>Manage Roles</FieldLegend>
                <FieldDescription>
                    {isSelfUpdate
                        ? "You are updating your own roles. The 'owner' role cannot be removed."
                        : 'Select roles to assign to this user'}
                </FieldDescription>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Roles</FieldLabel>
                        <div className="space-y-2 max-h-64 overflow-y-auto p-2 border rounded-md">
                            {roles.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">
                                    No roles available
                                </div>
                            ) : (
                                roles.map((role) => {
                                    const isOwnerRole = role.role === 'owner';
                                    const isDisabled = isSelfUpdate && isOwnerRole;

                                    return (
                                        <div
                                            key={role.id}
                                            className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm"
                                        >
                                            <Checkbox
                                                checked={selectedRoles.includes(role.role)}
                                                onCheckedChange={() => toggleRole(role.role)}
                                                disabled={isDisabled}
                                            />
                                            <span
                                                className={`flex-1 select-none capitalize ${
                                                    isDisabled
                                                        ? 'cursor-not-allowed opacity-50'
                                                        : 'cursor-pointer'
                                                }`}
                                                onClick={() => !isDisabled && toggleRole(role.role)}
                                            >
                                                {role.role}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <FieldDescription>Select one or more roles to assign to the user</FieldDescription>
                    </Field>
                    <Field>
                        <FieldContent>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Updating...' : 'Update Roles'}
                            </Button>
                        </FieldContent>
                    </Field>
                </FieldGroup>
            </FieldSet>
        </form>
    );
}
