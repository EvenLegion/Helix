'use client';

import { useState } from 'react';
import { Button } from '@workspace/ui/components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Badge } from '@workspace/ui/components/badge';
import { Separator } from '@workspace/ui/components/separator';
import { Textarea } from '@workspace/ui/components/textarea';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { acceptApplication, rejectApplication, deleteApplication } from '@/server/recruitment';
import { Eye, Check, X, Trash2, Loader2 } from 'lucide-react';

interface ApplicationReviewDialogProps {
    application: any;
    permissions: {
        canAccept: boolean;
        canReject: boolean;
        canDelete: boolean;
    };
}

export function ApplicationReviewDialog({ application, permissions }: ApplicationReviewDialogProps) {
    const [open, setOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const router = useRouter();

    const handleAccept = async () => {
        setIsProcessing(true);
        try {
            await acceptApplication(application.id);
            toast.success(`Application accepted from ${application.rsiHandle}`);
            setOpen(false);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to accept');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        setIsProcessing(true);
        try {
            await rejectApplication(application.id, rejectionReason);
            toast.success(`Application rejected from ${application.rsiHandle}`);
            setOpen(false);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to reject');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) return;

        setIsProcessing(true);
        try {
            await deleteApplication(application.id);
            toast.success(`Application deleted for ${application.rsiHandle}`);
            setOpen(false);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete');
        } finally {
            setIsProcessing(false);
        }
    };

    const isPending = application.status === 'pending';

    return (
        <Dialog open={open} onOpenChange={setOpen} modal={true}>
            <DialogTrigger render={<Button variant="ghost" size="sm" />}>
                <Eye className="h-4 w-4" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Application Review - {application.rsiHandle}</DialogTitle>
                    <DialogDescription>
                        <Badge
                            variant={
                                application.status === 'accepted'
                                    ? 'default'
                                    : application.status === 'rejected'
                                      ? 'destructive'
                                      : 'secondary'
                            }
                        >
                            {application.status.toUpperCase()}
                        </Badge>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm font-medium">RSI Handle</p>
                            <p className="text-sm text-muted-foreground">{application.rsiHandle}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Age</p>
                            <p className="text-sm text-muted-foreground">{application.age}</p>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm font-medium">Combat Experience</p>
                            <p className="text-sm text-muted-foreground">{application.combatExperience}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Logistics Experience</p>
                            <p className="text-sm text-muted-foreground">{application.logisticsExperience}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Support Experience</p>
                            <p className="text-sm text-muted-foreground">{application.supportExperience}</p>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <p className="text-sm font-medium mb-1">Star Citizen Experience</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {application.starCitizenExperience}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm font-medium mb-1">Top 3 Ships & Why</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{application.top3ShipsWhy}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium mb-1">When They Started Playing SC</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {application.whenStartPlayingSC}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm font-medium mb-1">Why Do They Want to Join?</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{application.whyJoin}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium">Discord Commitment</p>
                        <p className="text-sm text-muted-foreground">{application.canCommitToDiscord ? 'Yes' : 'No'}</p>
                    </div>

                    {!isPending && (
                        <>
                            <Separator />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium">Reviewed At</p>
                                    <p className="text-sm text-muted-foreground">
                                        {application.reviewedAt
                                            ? new Date(application.reviewedAt).toLocaleString()
                                            : '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Reviewed By</p>
                                    <p className="text-sm text-muted-foreground">{application.reviewedBy || '-'}</p>
                                </div>
                            </div>
                        </>
                    )}

                    {isPending && permissions.canReject && (
                        <div>
                            <label className="text-sm font-medium">Rejection Reason (Optional)</label>
                            <Textarea
                                placeholder="Provide a reason for rejection (optional)"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="mt-1"
                                rows={3}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter className="flex gap-2">
                    {isPending && permissions.canAccept && (
                        <Button
                            onClick={handleAccept}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isProcessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="mr-2 h-4 w-4" />
                            )}
                            Accept
                        </Button>
                    )}
                    {isPending && permissions.canReject && (
                        <Button onClick={handleReject} disabled={isProcessing} variant="destructive">
                            {isProcessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <X className="mr-2 h-4 w-4" />
                            )}
                            Reject
                        </Button>
                    )}
                    {!isPending && permissions.canDelete && (
                        <Button onClick={handleDelete} disabled={isProcessing} variant="destructive">
                            {isProcessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                        </Button>
                    )}
                    <Button onClick={() => setOpen(false)} disabled={isProcessing} variant="outline">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
