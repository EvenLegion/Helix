"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function ImpersonationBanner() {
    const [mounted, setMounted] = useState(false);
    const { data: session, isPending } = authClient.useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedUser, setImpersonatedUser] = useState<{
        id: string;
        name?: string;
        email?: string;
        username?: string;
    } | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Mark as mounted to prevent hydration mismatch
        setMounted(true);
    }, []);

    // Check impersonation status by fetching session directly
    useEffect(() => {
        if (!mounted) return;

        const checkImpersonation = async () => {
            try {
                const sessionData = await authClient.getSession();

                // Check multiple possible paths for impersonation
                const impersonatedBy =
                    sessionData.data?.session?.impersonatedBy ||
                    (sessionData.data?.session as any)?.impersonatedBy ||
                    (sessionData.data as any)?.impersonatedBy;

                if (impersonatedBy && sessionData.data?.user) {
                    setIsImpersonating(true);
                    setImpersonatedUser({
                        id: sessionData.data.user.id,
                        name: sessionData.data.user.name || undefined,
                        email: sessionData.data.user.email || undefined,
                        // @ts-expect-error user.nickname and username are valid properties
                        username: (sessionData.data.user.nickname ?? sessionData.data.user.username) || undefined,
                    });
                } else {
                    setIsImpersonating(false);
                    setImpersonatedUser(null);
                }
            } catch (error) {
                console.error("Error checking impersonation:", error);
                setIsImpersonating(false);
                setImpersonatedUser(null);
            }
        };

        checkImpersonation();

        // Re-check periodically and when session changes
        const interval = setInterval(checkImpersonation, 2000);
        return () => clearInterval(interval);
    }, [mounted, session]);
    const handleStopImpersonation = async () => {
        setIsLoading(true);
        try {
            await authClient.admin.stopImpersonating();
            toast.success("Stopped impersonating user");
            router.refresh();
            // Full page reload to ensure session is updated
            window.location.reload();
        } catch (error) {
            console.error("Failed to stop impersonation:", error);
            toast.error(error instanceof Error ? error.message : "Failed to stop impersonation");
        } finally {
            setIsLoading(false);
        }
    };

    // Don't render until mounted to prevent hydration mismatch
    // Show banner only when impersonating
    if (!mounted || isPending || !isImpersonating) {
        return null;
    }

    // If we don't have user info but we're impersonating, still show banner with ID
    if (!impersonatedUser) {
        return (
            <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-white shadow-lg">
                <div className="container mx-auto px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <span>Impersonating user</span>
                        </div>
                    </div>
                    <Button
                        onClick={handleStopImpersonation}
                        disabled={isLoading}
                        size="sm"
                        variant="secondary"
                        className="bg-white text-amber-600 hover:bg-gray-100"
                    >
                        {isLoading ? (
                            <>Stopping...</>
                        ) : (
                            <>
                                <X className="h-4 w-4 mr-1" />
                                Stop Impersonating
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-white shadow-lg">
            <div className="container mx-auto px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5" />
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span>Impersonating:</span>
                        <span className="font-bold">
                            {impersonatedUser.username || impersonatedUser.name || impersonatedUser.email || impersonatedUser.id}
                        </span>
                        {impersonatedUser.email && impersonatedUser.username && (
                            <span className="text-xs opacity-90">({impersonatedUser.email})</span>
                        )}
                    </div>
                </div>
                <Button
                    onClick={handleStopImpersonation}
                    disabled={isLoading}
                    size="sm"
                    variant="secondary"
                    className="bg-white text-amber-600 hover:bg-gray-100"
                >
                    {isLoading ? (
                        <>Stopping...</>
                    ) : (
                        <>
                            <X className="h-4 w-4 mr-1" />
                            Stop Impersonating
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
