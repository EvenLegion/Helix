import { Card, CardContent } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function RecruitmentConfirmationPage() {
    return (
        <div className="flex-2 min-h-svh items-center justify-center p-4">
            <Card className="w-full">
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                        </div>

                        <h1 className="mb-4 text-3xl font-bold">Application Submitted!</h1>

                        <p className="mb-6 text-lg text-muted-foreground">
                            Thank you for your interest in joining Even Legion. We've received your application and our
                            recruitment team will review it soon.
                        </p>

                        <div className="mb-8 w-full rounded-lg border border-border bg-muted/50 p-6">
                            <h2 className="mb-4 text-xl font-semibold">What's Next?</h2>
                            <ul className="space-y-3 text-left">
                                <li className="flex items-start gap-3">
                                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                        1
                                    </span>
                                    <span className="text-sm">
                                        Our recruitment team will review your application within 3-5 business days.
                                    </span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                        2
                                    </span>
                                    <span className="text-sm">
                                        If selected, you'll receive an email with next steps and an invitation to our
                                        Discord server.
                                    </span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                        3
                                    </span>
                                    <span className="text-sm">
                                        Complete your application on RSI.com to finalize your membership.
                                    </span>
                                </li>
                            </ul>
                        </div>
                        <p className="mt-8 text-sm text-muted-foreground">Questions? Contact us on Discord</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
