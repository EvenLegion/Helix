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
import { useState } from 'react';

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

            const memberId = member.id;

            if (!session?.session.activeOrganizationId) {
                throw new Error('No active organization found in session');
            }

            if (!memberId) {
                throw new Error('No member ID provided');
            }

            await authClient.organization.updateMemberRole({
                role: selectedRoles,
                memberId: memberId,
                organizationId: session.session.activeOrganizationId,
            });

            window.location.reload();
        } catch (error) {
            console.error('Failed to update roles:', error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit}>
            <FieldSet>
                <FieldLegend>Manage Roles</FieldLegend>
                <FieldDescription>Select roles to assign to this user</FieldDescription>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Roles</FieldLabel>
                        <div className="space-y-2 max-h-64 overflow-y-auto p-2 border rounded-md">
                            {roles.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">
                                    No roles available
                                </div>
                            ) : (
                                roles.map((role) => (
                                    <div
                                        key={role.id}
                                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm"
                                    >
                                        <Checkbox
                                            checked={selectedRoles.includes(role.role)}
                                            onCheckedChange={() => toggleRole(role.role)}
                                        />
                                        <span
                                            className="flex-1 select-none capitalize cursor-pointer"
                                            onClick={() => toggleRole(role.role)}
                                        >
                                            {role.role}
                                        </span>
                                    </div>
                                ))
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
