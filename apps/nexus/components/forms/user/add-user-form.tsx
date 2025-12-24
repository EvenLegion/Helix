"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"

import { Button } from "@workspace/ui/components/button"
import {
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import { Loader2, Search, User as UserIcon } from "lucide-react"
import { searchUsers, addUserToOrganization } from "@/server/organizations"
import type { OrganizationRole } from "@workspace/db"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"

const formSchema = z.object({
    userQuery: z.string().min(2, "Please enter at least 2 characters to search"),
    userId: z.string().min(1, "Please select a user"),
    role: z.string().min(1, "Please select a role"),
})

interface AddUserFormProps {
    onSuccess?: () => void;
    roles: OrganizationRole[];
}

type User = {
    id: string;
    email: string | null;
    username: string | null;
    nickname: string | null;
    image: string | null;
}

export function AddUserForm({ onSuccess, roles }: AddUserFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            userQuery: "",
            userId: "",
            role: "",
        },
    })

    // Get active organization
    const { data: activeOrg } = authClient.useActiveOrganization();

    // Debounced search
    useEffect(() => {
        const query = form.watch("userQuery");

        if (!query || query.trim().length < 2) {
            setSearchResults([]);
            setSelectedUser(null);
            form.setValue("userId", "");
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                setIsSearching(true);
                const results = await searchUsers(query);
                setSearchResults(results);
            } catch (error) {
                console.error("Error searching users:", error);
                toast.error("Failed to search users");
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [form.watch("userQuery")]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!activeOrg?.id) {
            toast.error("No active organization selected");
            return;
        }

        try {
            setIsLoading(true);
            await addUserToOrganization(values.userId, activeOrg.id, values.role);

            toast.success("User added to organization successfully!");
            form.reset();
            setSelectedUser(null);
            setSearchResults([]);
            router.refresh();
            onSuccess?.();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to add user to organization.");
        } finally {
            setIsLoading(false);
        }
    }

    const handleUserSelect = (user: User) => {
        setSelectedUser(user);
        form.setValue("userId", user.id);
        form.setValue("userQuery", user.email || user.username || user.nickname || "");
    };

    // Filter roles by active organization and get available roles (including "owner" if needed)
    const rolesForActiveOrg = activeOrg?.id
        ? roles.filter(role => role.organizationId === activeOrg.id)
        : [];

    const availableRoles = [
        { value: "owner", label: "Owner" },
        ...rolesForActiveOrg.map(role => ({
            value: role.role,
            label: role.role.charAt(0).toUpperCase() + role.role.slice(1)
        })),
    ];

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Controller
                control={form.control}
                name="userQuery"
                render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor={field.name}>Search User</FieldLabel>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                id={field.name}
                                placeholder="Search by email, username, or nickname..."
                                className="pl-9"
                                {...field}
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                        <FieldDescription>Enter at least 2 characters to search for users</FieldDescription>
                        <FieldError errors={fieldState.error ? [fieldState.error] : undefined} />

                        {/* Search Results */}
                        {searchResults.length > 0 && !selectedUser && (
                            <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                                {searchResults.map((user) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => handleUserSelect(user)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left"
                                    >
                                        <Avatar className="size-8">
                                            <AvatarImage src={user.image || undefined} />
                                            <AvatarFallback>
                                                <UserIcon className="size-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">
                                                {user.nickname || user.username || "Unknown"}
                                            </div>
                                            <div className="text-sm text-muted-foreground truncate">
                                                {user.email || "No email"}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Selected User Display */}
                        {selectedUser && (
                            <div className="mt-2 border rounded-md p-3 bg-accent/50">
                                <div className="flex items-center gap-3">
                                    <Avatar className="size-8">
                                        <AvatarImage src={selectedUser.image || undefined} />
                                        <AvatarFallback>
                                            <UserIcon className="size-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">
                                            {selectedUser.nickname || selectedUser.username || "Unknown"}
                                        </div>
                                        <div className="text-sm text-muted-foreground truncate">
                                            {selectedUser.email || "No email"}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedUser(null);
                                            form.setValue("userId", "");
                                        }}
                                    >
                                        Change
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Field>
                )}
            />

            <Controller
                control={form.control}
                name="role"
                render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor={field.name}>Role</FieldLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id={field.name} className="w-full">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableRoles.map((role) => (
                                    <SelectItem key={role.value} value={role.value}>
                                        {role.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldDescription>Select the role to assign to this user</FieldDescription>
                        <FieldError errors={fieldState.error ? [fieldState.error] : undefined} />
                    </Field>
                )}
            />

            <Button disabled={isLoading || !selectedUser} type="submit" className="w-full">
                {isLoading ? (
                    <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        Adding User...
                    </>
                ) : (
                    "Add User to Organization"
                )}
            </Button>
        </form>
    )
}
