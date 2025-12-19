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
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Loader2 } from "lucide-react"
import { Controller } from "react-hook-form"

const formSchema = z.object({
    name: z.string().min(2).max(50),
    slug: z.string().min(2).max(50),
})

interface CreateOrganizationFormProps {
    onSuccess?: () => void;
}

export function
CreateOrganizationForm({ onSuccess }: CreateOrganizationFormProps) {
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
            const result = await authClient.organization.create({
                name: values.name,
                slug: values.slug,
            })

            // Set the newly created organization as active
            if (result.data) {
                await authClient.organization.setActive({
                    organizationId: result.data.id,
                });
            }

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Controller
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor={field.name}>Organization Name</FieldLabel>
                        <Input
                            id={field.name}
                            placeholder="My Organization"
                            {...field}
                        />
                        <FieldDescription>This is the name of your organization.</FieldDescription>
                        <FieldError errors={fieldState.error ? [fieldState.error] : undefined} />
                    </Field>
                )}
            />
            <Controller
                control={form.control}
                name="slug"
                render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor={field.name}>Organization Slug</FieldLabel>
                        <Input
                            id={field.name}
                            placeholder="my-organization"
                            {...field}
                        />
                        <FieldDescription>This is the unique identifier for your organization.</FieldDescription>
                        <FieldError errors={fieldState.error ? [fieldState.error] : undefined} />
                    </Field>
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
    )
}
