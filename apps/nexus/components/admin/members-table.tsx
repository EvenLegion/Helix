"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@workspace/ui/components/table";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@workspace/ui/components/dialog";
import { X } from "lucide-react";

//  TODO: Add filtering and sorting capabilities to the table

export function MembersTable({
    members,
}: {
    members: {
        id: string;
        userId: string;
        role: string;
        joinedAt: string;
        username?: string;
        permissions: Array<{ category: string; permission: string }>;
    }[];
}) {

    const router = useRouter();
    const {data: session} = authClient.useSession();
    //Hovered State for badges
    const [roleToRemove, setRoleToRemove] = useState<{ memberId: string; role: string } | null>(null); // Changed type

    // Group permissions by category
    const groupPermissions = (permissions: Array<{ category: string; permission: string }>) => {
        const grouped = permissions.reduce((acc, { category, permission }) => {
            if (!acc[category]) acc[category] = [];
            acc[category].push(permission);
            return acc;
        }, {} as Record<string, string[]>);

        return grouped;
    };

    const handleRemoveRole = async (memberId: string, role: string) => {

        // Get current roles for member
        const member = members.find(m => m.id === memberId);

        // Removing role from comma-separated list
        if (!member) return;
        const currentRoles = member.role.split(',').map(r => r.trim());
        const updatedRoles = currentRoles.filter(r => r !== role).join(', ');

        if (updatedRoles.length === 0) {
            // If no roles left, remove member from organization
            try {
                const {data, error} = await authClient.organization.removeMember({
                    memberIdOrEmail: memberId,
                    organizationId: session?.session?.activeOrganizationId as string
                });
                if (error) {
                    console.error("Failed to remove member:", error);
                    return;
                }
                console.log("Member removed successfully:", data);
                // Optionally, refresh the members list or update state here
            } catch (error) {
            console.error("Failed to remove member:", error);
            return;
            }
            router.refresh(); // Refresh to show updated members
            setRoleToRemove(null);
            return;
        }

        try {

            const {data, error} = await authClient.organization.updateMemberRole({
                role: updatedRoles,
                memberId: memberId,
                organizationId: session?.session?.activeOrganizationId as string
            });

            if (error) {
                console.error("Failed to remove role:", error);
                return;
            }
            console.log("Role removed successfully:", data);
            // Optionally, refresh the members list or update state here
        } catch (error) {
            console.error("Failed to remove role:", error);
            return;
        }

        // Logic to remove role from member
        router.refresh(); // Refresh to show updated roles
        setRoleToRemove(null);
    }

    // Define colors for different roles
    const roleColors: Record<string, string> = {
        owner: "bg-[#760a0b] text-white border-[#760a0b]",
        administrator: "bg-[#604d00] text-white border-[#604d00]",
        imperator: "bg-[#303069] text-white border-[#303069]",
    }

    return (
        <Table>
            <TableCaption>List of organization members</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Joined At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {members.map((member) => {
                    const groupedPerms = groupPermissions(member.permissions);

                    const roles = member.role.split(',').map(r => r.trim());

                    return (
                        <TableRow key={member.userId}>
                            <TableCell className="font-medium">{member.userId}</TableCell>
                            <TableCell>{member.username}</TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {roles.map((role, idx) => (
                                        <Badge
                                            key={idx}
                                            variant="outline"
                                            className={`text-xs flex items-center gap-1 pr-1 capitalize leading-none ${roleColors[role]}`}
                                        >
                                            <div className=" flex items-center leading-none">
                                                {role}
                                            </div>
                                            <button
                                                onClick={() => setRoleToRemove({ memberId: member.id, role })} // Set role to remove on click
                                                className="text-muted-foreground transition-colors hover:bg-destructive rounded-full p-0.5 flex items-center justify-center"
                                            >
                                                <X color="white" className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                        ))}
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Badge variant="secondary" className="text-xs cursor-pointer">
                                                +
                                            </Badge>
                                        </DialogTrigger>
                                        <DialogContent className="md:max-w-lg">
                                            <DialogHeader>
                                                <DialogTitle>Add Role</DialogTitle>
                                                <DialogDescription>
                                                    Add a role to the user in the organization.
                                                </DialogDescription>
                                            </DialogHeader>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                                {/* Confirmation Dialog for Role Removal */}
                                <Dialog open={!!roleToRemove} onOpenChange={(open) => !open && setRoleToRemove(null)}>
                                    <DialogContent className="md:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle>Remove Role</DialogTitle>
                                            <DialogDescription>
                                                Are you sure you want to remove the role {roleToRemove?.role} from this user?
                                                This action cannot be undone.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="flex justify-end gap-2 mt-4">
                                            <Button variant="outline" onClick={() => setRoleToRemove(null)}>
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={() => roleToRemove && handleRemoveRole(roleToRemove.memberId, roleToRemove.role)}
                                            >
                                                Remove Role
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-2">
                                    {Object.entries(groupedPerms).map(([category, perms]) => (
                                        <div key={category} className="space-y-1">
                                            <div className="font-semibold text-sm capitalize">{category}: </div>
                                            <div className="flex flex-wrap gap-1">
                                                {perms.map((perm, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                        {perm}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell>{new Date(member.joinedAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {/* Placeholder for action buttons */}
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button className="mt-8 ml-4 ">Edit</Button>
                                        </DialogTrigger>
                                        <DialogContent className="md:max-w-lg">
                                            <DialogHeader>
                                                <DialogTitle>User Edit</DialogTitle>
                                                <DialogDescription>
                                                    Edit a user in the organization.
                                                </DialogDescription>
                                            </DialogHeader>
                                        </DialogContent>
                                    </Dialog>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button className="mt-8 ml-4 ">Edit</Button>
                                        </DialogTrigger>
                                        <DialogContent className="md:max-w-lg">
                                            <DialogHeader>
                                                <DialogTitle>User Edit</DialogTitle>
                                                <DialogDescription>
                                                    Edit a user in the organization.
                                                </DialogDescription>
                                            </DialogHeader>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
