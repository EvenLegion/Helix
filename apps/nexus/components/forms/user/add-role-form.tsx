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
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { Check, ChevronsUpDown, X } from 'lucide-react';

import type { OrganizationRole } from '@workspace/db';
import type { Member } from '@/components/admin/members-columns';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';

interface AddRoleFormProps {
    roles: OrganizationRole[];
    member: Member;
}

export function AddRoleForm({ roles, member }: AddRoleFormProps) {
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const toggleRole = (roleId: string) => {
        setSelectedRoles((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
        );
    };

    const removeRole = (roleId: string) => {
        setSelectedRoles((prev) => prev.filter((id) => id !== roleId));
    };

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (selectedRoles.length === 0) {
            return;
        }

        setIsLoading(true);
        try {
            // Get active organization from session
            const { data: session } = await authClient.getSession();

            const memberId = member.id;
            const currentRoles = member.role;
            const rolesArray: any = [];

            if (currentRoles) {
                rolesArray.push(...currentRoles.split(',').map((r) => r.trim()));
            }

            // Add all selected roles that aren't already assigned
            selectedRoles.forEach((role) => {
                if (!rolesArray.includes(role)) {
                    rolesArray.push(role);
                }
            });

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
            console.error('Failed to add roles:', error);
        } finally {
            setIsLoading(false);
            window.location.reload();
        }
    }

    return (
        <form onSubmit={onSubmit}>
            <FieldSet>
                <FieldLegend>Add Role</FieldLegend>
                <FieldDescription>Add one or more roles to a user's profile</FieldDescription>
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="role">Role(s)</FieldLabel>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger render={(props) => (
                                <Button
                                    {...props}
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between"
                                >
                                    {selectedRoles.length === 0 ? (
                                        'Select roles...'
                                    ) : (
                                        <div className="flex gap-1 flex-wrap">
                                            {selectedRoles.map((roleId) => {
                                                const role = roles.find((r) => r.role === roleId);
                                                return (
                                                    <Badge key={roleId} variant="secondary" className="mr-1">
                                                        {role?.role}
                                                        <button
                                                            type="button"
                                                            className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    removeRole(roleId);
                                                                }
                                                            }}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                            }}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                removeRole(roleId);
                                                            }}
                                                        >
                                                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                        </button>
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            )} />
                            <PopoverContent className="w-full p-0">
                                <div className="max-h-64 overflow-auto p-1">
                                    {roles
                                        .filter((role) => {
                                            // Filter out roles the user already has
                                            const currentRoles = member.role
                                                ? member.role.split(',').map((r) => r.trim())
                                                : [];
                                            return !currentRoles.includes(role.role);
                                        })
                                        .map((role) => (
                                            <div
                                                key={role.id}
                                                className="flex items-center space-x-2 p-2 cursor-pointer hover:bg-accent rounded-sm"
                                                onClick={() => toggleRole(role.role)}
                                            >
                                                <div className="flex h-4 w-4 items-center justify-center border rounded-sm border-primary">
                                                    {selectedRoles.includes(role.role) && (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                </div>
                                                <span className="flex-1">{role.role}</span>
                                            </div>
                                        ))}
                                    {roles.filter((role) => {
                                        const currentRoles = member.role
                                            ? member.role.split(',').map((r) => r.trim())
                                            : [];
                                        return !currentRoles.includes(role.role);
                                    }).length === 0 && (
                                        <div className="p-4 text-sm text-muted-foreground text-center">
                                            No additional roles available
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <FieldDescription>Select one or more roles to add to the user</FieldDescription>
                    </Field>
                    <Field>
                        <FieldContent>
                            <Button type="submit" disabled={selectedRoles.length === 0 || isLoading}>
                                {isLoading ? 'Adding...' : `Add Role${selectedRoles.length !== 1 ? 's' : ''}`}
                            </Button>
                        </FieldContent>
                    </Field>
                </FieldGroup>
            </FieldSet>
        </form>
    );
}
