'use client';

import { MembersDataTable } from './members-data-table';
import { getMembersColumns, type Member } from './members-columns';
import type { OrganizationRole } from '@workspace/db';
import { authClient } from '@/lib/auth-client';
import { useState, useEffect, useMemo } from 'react';

export function MembersTable({
    members,
    organizationName,
    roles,
}: {
    members: Member[];
    organizationName?: string;
    roles: OrganizationRole[];
}) {
    const [permissions, setPermissions] = useState({
        canUpdateRoles: false,
        canDelete: false,
        canImpersonate: false,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const checkPermissions = async () => {
            setIsLoading(true);
            try {
                // Debug: Check active organization
                const activeOrg = await authClient.organization.getActiveMember();
                console.log('[MembersTable] Active member:', activeOrg);

                const [updateResult, deleteResult, impersonateResult] = await Promise.all([
                    authClient.organization.hasPermission({
                        permissions: { member: ['update'] }
                    }),
                    authClient.organization.hasPermission({
                        permissions: { member: ['delete'] }
                    }),
                    authClient.admin.hasPermission({
                        permissions: { user: ['impersonate'] }
                    }),
                ]);

                // Debug: Log results
                console.log('[MembersTable] Update permission result:', updateResult);
                console.log('[MembersTable] Delete permission result:', deleteResult);
                console.log('[MembersTable] Impersonate permission result:', impersonateResult);

                if (!isMounted) return;

                const getSuccess = (result: typeof updateResult) => {
                    if ('error' in result && result.error) {
                        console.log('[MembersTable] Permission error:', result.error);
                        return false;
                    }
                    if ('data' in result) return result.data.success ?? false;
                    return false;
                };

                const perms = {
                    canUpdateRoles: getSuccess(updateResult),
                    canDelete: getSuccess(deleteResult),
                    canImpersonate: getSuccess(impersonateResult),
                };
                console.log('[MembersTable] Final permissions:', perms);
                setPermissions(perms);
            } catch (error) {
                console.error('Error checking permissions:', error);
                if (isMounted) {
                    setPermissions({
                        canUpdateRoles: false,
                        canDelete: false,
                        canImpersonate: false,
                    });
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        checkPermissions();

        return () => {
            isMounted = false;
        };
    }, []);

    // Memoize permissions object to prevent unnecessary recalculations
    const permissionsRef = useMemo(
        () => permissions,
        [permissions.canUpdateRoles, permissions.canDelete, permissions.canImpersonate]
    );

    const membersColumns = useMemo(
        () => getMembersColumns(roles, permissionsRef),
        [roles, permissionsRef]
    );

    return (
        <MembersDataTable columns={membersColumns} data={members} organizationName={organizationName} roles={roles} />
    );
}
