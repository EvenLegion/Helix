'use client';

import { authClient } from '@/lib/auth-client';
import { Organization } from '@workspace/db';
import { useEffect, useState } from 'react';
import { Badge } from '@workspace/ui/components/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select';
import { toast } from 'sonner';

interface ActiveOrgProps {
    organizations: Organization[];
}

export default function ActiveOrg({ organizations }: ActiveOrgProps) {
    const { data: activeOrg } = authClient.useActiveOrganization();
    const [selectedOrg, setSelectedOrg] = useState<string>(activeOrg?.id || '');

    console.log('[CLIENT] ActiveOrg rendered with:', organizations.map(o => ({
        name: o.name,
        isRecruiting: o.isRecruiting
    })));

    // Sync with activeOrg from Better Auth
    useEffect(() => {
        if (activeOrg?.id && activeOrg.id !== selectedOrg) {
            setSelectedOrg(activeOrg.id);
        }
    }, [activeOrg?.id, selectedOrg]);


    const handleOrgChange = async (organizationId: string | null) => {
        if (!organizationId) return;

        setSelectedOrg(organizationId);
        try {
            const { error } = await authClient.organization.setActive({
                organizationId,
            });

            if (error) {
                toast.error('Failed to set active organization');
            }
            toast.success('Active organization set');
        } catch {
            toast.error('Failed to set active organization');
        }
    };

    const selectedOrgData = organizations.find((org) => org.id === selectedOrg);
    const selectedOrgName = selectedOrgData?.name;
    const isOrgRecruiting = selectedOrgData?.isRecruiting === true;

    return (
        <div className="flex items-center gap-4">
            <Select onValueChange={handleOrgChange} value={selectedOrg}>
                <SelectTrigger className="w-full">
                    <SelectValue>{selectedOrgName || 'Select Active Organization'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                            {org.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {isOrgRecruiting && <Badge>Recruiting</Badge>}
        </div>
    );
}
