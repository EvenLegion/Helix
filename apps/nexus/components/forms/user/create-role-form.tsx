'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useState } from 'react';
import { z } from 'zod';
import { statement } from '@/lib/auth/permissions';

import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@workspace/ui/components/command';
import { Button } from '@workspace/ui/components/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@workspace/ui/components/form';
import { Input } from '@workspace/ui/components/input';
import { Loader2 } from 'lucide-react';
import { Check } from 'lucide-react';

const formSchema = z.object({
    name: z.string().min(2).max(50),
    application: z.custom<keyof typeof statement>(),
    permissions: z.array(z.string()).min(1, 'Pick at least one permission'),
});

export function CreateRoleForm() {
    const [isLoading, setIsLoading] = useState(false);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            permissions: [],
            application: (Object.keys(statement)[0] ?? '') as keyof typeof statement,
        },
    });

    const { data: session } = authClient.useSession();

    async function onSubmit(values: z.infer<typeof formSchema>) {
        const activeOrg = session?.session?.activeOrganizationId;

        if (!activeOrg) {
            toast.error('No active organization found.');
            return;
        }

        const permissions = {
            [values.application]: values.permissions,
        };

        try {
            setIsLoading(true);

            await authClient.organization.createRole({
                role: values.name,
                permission: permissions,
                organizationId: activeOrg,
            });

            toast.success('Role created successfully!');
            form.reset();
        } catch (error) {
            console.error('Full error object:', error);
            console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

            // Log the response details if available
            if (error && typeof error === 'object' && 'response' in error) {
                console.error('Response error:', error.response);
            }

            toast.error('Failed to create role.');
        } finally {
            setIsLoading(false);

            // Refresh the page to reflect the new role
            window.location.reload();
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Role Name</FormLabel>
                            <FormControl>
                                <Input placeholder="My Role" {...field} />
                            </FormControl>
                            <FormDescription>This is the name of the role.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Application (resource) single-select */}
                <FormField
                    control={form.control}
                    name="application"
                    render={({ field }) => {
                        const current = field.value as keyof typeof statement | undefined;
                        return (
                            <FormItem>
                                <FormLabel>Application</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {current ?? 'Select application'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-[300px]">
                                        <Command>
                                            <CommandInput placeholder="Search application..." />
                                            <CommandList>
                                                <CommandEmpty>No application found.</CommandEmpty>
                                                <CommandGroup heading="Applications">
                                                    {Object.keys(statement).map((app) => (
                                                        <CommandItem key={app} onSelect={() => field.onChange(app)}>
                                                            <Check
                                                                className={`mr-2 h-4w-4 ${
                                                                    app === current ? 'opacity-100' : 'opacity-0'
                                                                }`}
                                                            />
                                                            {app}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormDescription>Select the application for the role.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />

                {/* Permissions multi-select */}
                <FormField
                    control={form.control}
                    name="permissions"
                    render={() => {
                        const app = form.watch('application') as keyof typeof statement | undefined;
                        const availablePermissions = app ? (statement[app] as readonly string[]) : [];
                        const selectedPermissions = new Set(form.getValues('permissions'));

                        const togglePermission = (perm: string) => {
                            const next = new Set(selectedPermissions);
                            if (next.has(perm)) {
                                next.delete(perm);
                            } else {
                                next.add(perm);
                            }
                            form.setValue('permissions', Array.from(next), { shouldValidate: true });
                        };
                        return (
                            <FormItem>
                                <FormLabel>Permissions</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {selectedPermissions.size
                                                ? `${selectedPermissions.size} selected`
                                                : 'Select permissions'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-[360px]">
                                        <Command>
                                            <CommandInput placeholder="Search permissions..." />
                                            <CommandList>
                                                <CommandEmpty>No permission found.</CommandEmpty>
                                                <CommandGroup heading={app ?? '-'}>
                                                    {availablePermissions.map((perm) => {
                                                        const isOn = selectedPermissions.has(perm);
                                                        return (
                                                            <CommandItem
                                                                key={perm}
                                                                onSelect={() => togglePermission(perm)}
                                                            >
                                                                <Check
                                                                    className={`mr-2 h-4 w-4 ${isOn ? 'opacity-100' : 'opacity-0'}`}
                                                                />
                                                                {perm}
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormDescription>Select permissions for the role.</FormDescription>
                                <FormMessage />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {Array.from(selectedPermissions).map((perm) => (
                                        <span key={perm} className="px-2 py-1 text-xs rounded-full bg-secondary">
                                            {perm}
                                        </span>
                                    ))}
                                </div>
                            </FormItem>
                        );
                    }}
                />
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Role
                </Button>
            </form>
        </Form>
    );
}
