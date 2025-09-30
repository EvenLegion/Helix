"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { z } from "zod"

import { Button } from "@workspace/ui/components/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
    name: z.string().min(2).max(50),
    slug: z.string().min(2).max(50),
})

interface CreateOrganizationFormProps {
    onSuccess?: () => void;
}

export function CreateOrganizationForm({ onSuccess }: CreateOrganizationFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            slug: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            setIsLoading(true);
            await authClient.organization.create({
                name: values.name,
                slug: values.slug,
            })
            toast.success("Organization created successfully!")
            form.reset();
            router.refresh();
            onSuccess?.();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create organization.")
        } finally {
            setIsLoading(false);
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
                            <FormLabel>Organization Name</FormLabel>
                            <FormControl>
                                <Input placeholder="My Organization" {...field} />
                            </FormControl>
                            <FormDescription>This is the name of your organization.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Organization Slug</FormLabel>
                            <FormControl>
                                <Input placeholder="my-organization" {...field} />
                            </FormControl>
                            <FormDescription>This is the unique identifier for your organization.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button disabled={isLoading} type="submit">
                    {isLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                        ) : (
                        "Create Organization"
                        )}
                </Button>
            </form>
        </Form>
    )
}
