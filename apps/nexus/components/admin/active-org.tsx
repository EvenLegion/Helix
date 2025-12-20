"use client";

import { authClient } from "@/lib/auth-client";
import { Organization } from "@workspace/db";
import { useEffect, useState } from "react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@workspace/ui/components/select';
import { toast } from "sonner";

interface ActiveOrgProps {
    organizations: Organization[];
}

export default function ActiveOrg({
    organizations
}: ActiveOrgProps) {
    const { data: activeOrg } = authClient.useActiveOrganization();
    const [selectedOrg, setSelectedOrg] = useState<string>("");

    useEffect(() => {
        if (activeOrg?.id) {
            setSelectedOrg(activeOrg.id);
        }
    }, [activeOrg?.id]);

    const handleOrgChange = async (organizationId: string | null) => {
        if (!organizationId) return;

        setSelectedOrg(organizationId);
        try {
            const { error } = await authClient.organization.setActive({
                organizationId,
            });

            if (error) {
                toast.error("Failed to set active organization");
            }
            toast.success("Active organization set");
        } catch {
            toast.error("Failed to set active organization");
        }
    }

    const selectedOrgName = organizations.find(org => org.id === selectedOrg)?.name;

    return (
        <Select onValueChange={handleOrgChange} value={selectedOrg}>
            <SelectTrigger className="w-full">
                <SelectValue>
                    {selectedOrgName || "Select Active Organization"}
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
    );
}
