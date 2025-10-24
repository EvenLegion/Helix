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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select';
import { Button } from '@workspace/ui/components/button';

import type { OrganizationRole } from '@workspace/db';
import type { Member } from '@/components/admin/members-columns';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';

interface AddRoleFormProps {
    roles: OrganizationRole[];
    member: Member;
}

export function AddRoleForm({ roles, member }: AddRoleFormProps) {
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!selectedRole) {
            return;
        }

        setIsLoading(true);
        try {
            // Get active organization from session
            const { data: session } = await authClient.getSession();

            const memberId = member.id;
            const currentRoles = member.role;
            const rolesArray = [];

            if (currentRoles) {
                rolesArray.push(...currentRoles.split(',').map((r) => r.trim()));
            }
            if (!rolesArray.includes(selectedRole)) {
                rolesArray.push(selectedRole);
            }

            if (!session?.session.activeOrganizationId) {
                throw new Error('No active organization found in session');
            }

            if (!memberId) {
                throw new Error('No member ID provided');
            }

            await authClient.organization.updateMemberRole({
                role: rolesArray,
                memberId: memberId,
                organizationId: session.session.activeOrganizationId,
            });
        } catch (error) {
            console.error('Failed to add role:', error);
        } finally {
            setIsLoading(false);
            window.location.reload();
        }
    }

    return (
        <form onSubmit={onSubmit}>
            <FieldSet>
                <FieldLegend>Add Role</FieldLegend>
                <FieldDescription>Add a role to a users profile</FieldDescription>
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="role">Role(s)</FieldLabel>
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select a Role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={role.role}>
                                        {role.role}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldDescription>Select a role to add to the user</FieldDescription>
                    </Field>
                    <Field>
                        <FieldContent>
                            <Button type="submit" disabled={!selectedRole || isLoading}>
                                {isLoading ? 'Adding...' : 'Add Role'}
                            </Button>
                        </FieldContent>
                    </Field>
                </FieldGroup>
            </FieldSet>
        </form>
    );
}
