"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@workspace/ui/components/dialog";
import { getRoleInfo } from "@/lib/auth/permissions";

interface Member {
    id: string;
    role: string;
    name?: string;
    email?: string;
    joinedAt: string;
}

interface RoleManagementProps {
    members: Member[];
    onRoleChange: (memberId: string, newRole: string) => Promise<void>;
}

export function RoleManagement({ members, onRoleChange }: RoleManagementProps) {
    const { data: session } = authClient.useSession();
    const [isChangingRole, setIsChangingRole] = useState<string | null>(null);

    const roles = ['owner', 'admin', 'manager', 'member', 'viewer'];

    const handleRoleChange = async (memberId: string, newRole: string) => {
        setIsChangingRole(memberId);
        try {
            await onRoleChange(memberId, newRole);
        } finally {
            setIsChangingRole(null);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Member Roles</h3>
            <div className="space-y-2">
                {members.map((member) => {
                    const roleInfo = getRoleInfo(member.role);
                    return (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                                <div>
                                    <p className="font-medium">{member.name || member.id}</p>
                                    <p className="text-sm text-gray-500">{member.email}</p>
                                </div>
                                <Badge variant="secondary" className={roleInfo.color}>
                                    {roleInfo.name}
                                </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Select
                                    value={member.role}
                                    onValueChange={(newRole) => handleRoleChange(member.id, newRole)}
                                    disabled={isChangingRole === member.id}
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role} value={role}>
                                                {getRoleInfo(role).name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {member.id !== session?.user?.id && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            // Add remove member functionality
                                            console.log('Remove member:', member.id);
                                        }}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
