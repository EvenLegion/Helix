'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';
import { cn } from '@workspace/ui/lib/utils';

import { useState } from 'react';
import { Field, FieldLabel, FieldGroup, FieldDescription, FieldError } from '@workspace/ui/components/field';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Textarea } from '@workspace/ui/components/textarea';
import { Slider } from '@workspace/ui/components/slider';
import { Separator } from '@workspace/ui/components/separator';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { Check } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';

const ApplicationFormSchema = z.object({
    rsiHandle: z
        .string()
        .min(5, { message: 'RSI Handle must be at least 5 characters long' })
        .max(32, { message: 'RSI Handle must be at most 30 characters long' }),
    age: z
        .number({ message: 'Please enter a valid number' })
        .min(18, { message: 'You must be at least 18 years old to apply' }) // TODO: Do we want this to be shown?
        .max(120, { message: 'Please enter a valid age' }),
    combatExperience: z
        .number()
        .min(1, { message: 'Please rate your combat experience' })
        .max(5, { message: 'Please rate your combat experience' }),
    logisticsExperience: z
        .number()
        .min(1, { message: 'Please rate your logistics experience' })
        .max(5, { message: 'Please rate your logistics experience' }),
    supportExperience: z
        .number()
        .min(1, { message: 'Please rate your support experience' })
        .max(5, { message: 'Please rate your support experience' }),
    starCitizenExperience: z.string().min(10, { message: 'Please describe your Star Citizen experience' }),
    top3ShipsWhy: z.string().min(10, { message: 'Please describe your top 3 ships and why' }),
    whenDidYouStartPlayingSC: z.string().min(10, { message: 'Please describe when you started playing Star Citizen' }),
    whyDoYouWantToJoin: z.string().min(10, { message: 'Please describe why you want to join our organization' }),
});

export function ApplicationForm({ session }: { session: any }) {
    const form = useForm<z.infer<typeof ApplicationFormSchema>>({
        resolver: zodResolver(ApplicationFormSchema),
        defaultValues: {
            rsiHandle: '',
            combatExperience: 1,
            logisticsExperience: 1,
            supportExperience: 1,
            starCitizenExperience: '',
            top3ShipsWhy: '',
        },
        mode: 'onBlur',
    });

    function onSubmit(data: z.infer<typeof ApplicationFormSchema>) {
        toast('Your application has submitted with the following data: ', {
            description: (
                <pre className="mt-2 rounded bg-gray-100 p-2 text-sm text-gray-800">
                    <code>{JSON.stringify(data, null, 2)}</code>
                </pre>
            ),
            position: 'bottom-right',
            classNames: {
                content: 'flex flex-col gap-2',
            },
            style: {
                '--border-radius': 'calc(var(--radius)  + 4px)',
            } as React.CSSProperties,
        });
    }

    return (
        <div className="min-h-svh p-4">
            <Card className="w-full">
                <CardContent>
                    <form id="application-form" onSubmit={form.handleSubmit(onSubmit)}>
                        <h2 className="mb-4 text-xl font-bold">Recruitment Application</h2>
                        <h3 className="mb-4 text-lg font-medium">Personal Information</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FieldGroup>
                                <Controller
                                    name="rsiHandle"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="rsiHandle">RSI Handle</FieldLabel>
                                            <Input
                                                {...field}
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="Enter your RSI Handle"
                                                autoComplete="off"
                                            />
                                            <FieldDescription>Please enter your RSI Handle.</FieldDescription>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <FieldGroup>
                                <Controller
                                    name="age"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="age">Age</FieldLabel>
                                            <Input
                                                {...field}
                                                type="number"
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="Enter your age"
                                                autoComplete="off"
                                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 18)}
                                            />
                                            <FieldDescription>Please enter your age.</FieldDescription>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                        </div>
                        <Separator className="my-4" />
                        <h3 className="my-4 text-lg font-medium">Experience</h3>
                        <FieldGroup className="mt-4">
                            <Controller
                                name="starCitizenExperience"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="starCitizenExperience">Star Citizen Experience</FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Describe your star citizen experience"
                                            rows={4}
                                        />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <FieldGroup className="mt-4">
                            <Controller
                                name="top3ShipsWhy"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="top3ShipsWhy">Top 3 Ships and Why</FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Describe your top 3 ships and why"
                                            rows={4}
                                        />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <FieldGroup className="mt-4">
                                <Controller
                                    name="combatExperience"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="combatExperience">
                                                Combat Experience: {field.value}/5
                                            </FieldLabel>
                                            <Slider
                                                value={[field.value]}
                                                onValueChange={(val) => field.onChange(val)}
                                                min={1}
                                                max={5}
                                                step={1}
                                                className={cn('w-full', 'bg-secondary')}
                                            />
                                            <FieldDescription>
                                                Rate your combat experience from 1 (beginner) to 5 (expert)
                                            </FieldDescription>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <FieldGroup className="mt-4">
                                <Controller
                                    name="logisticsExperience"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="logisticsExperience">
                                                Logistics Experience: {field.value}/5
                                            </FieldLabel>
                                            <Slider
                                                value={[field.value]}
                                                onValueChange={(val) => field.onChange(val)}
                                                min={1}
                                                max={5}
                                                step={1}
                                                className={cn('w-full', 'bg-secondary')}
                                            />
                                            <FieldDescription>
                                                Rate your logistics experience from 1 (beginner) to 5 (expert)
                                            </FieldDescription>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <FieldGroup className="mt-4">
                                <Controller
                                    name="supportExperience"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="supportExperience">
                                                Support Experience: {field.value}/5
                                            </FieldLabel>
                                            <Slider
                                                value={[field.value]}
                                                onValueChange={(val) => field.onChange(val)}
                                                min={1}
                                                max={5}
                                                step={1}
                                                className={cn('w-full', 'bg-secondary')}
                                            />
                                            <FieldDescription>
                                                Rate your support experience from 1 (beginner) to 5 (expert)
                                            </FieldDescription>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                        </div>
                        <Separator className="my-4" />
                        <h3 className="text-lg font-semibold">Additional Information</h3>
                        <FieldGroup className="mt-4">
                            <Controller
                                name="whenDidYouStartPlayingSC"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="whenDidYouStartPlayingSC">
                                            When Did You Start Playing Star Citizen?
                                        </FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Describe when you started playing Star Citizen"
                                            rows={4}
                                        />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <FieldGroup className="mt-4">
                            <Controller
                                name="whyDoYouWantToJoin"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="whyDoYouWantToJoin">
                                            Why Do You Want to Join Our Organization?
                                        </FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Describe why you want to join our organization"
                                            rows={4}
                                        />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <div className="mt-4">
                            <FieldGroup>
                                <div className="flex items-center gap-3">
                                    <Checkbox id="canCommitToVC">
                                        <Check className="h-4 w-4" />
                                    </Checkbox>
                                    <FieldLabel htmlFor="canCommitToVC" className="mb-0">
                                        Can you commit to using discord for voice comms?
                                    </FieldLabel>
                                </div>
                            </FieldGroup>
                        </div>
                        <Button type="submit" className="mt-6">
                            Submit Application
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
