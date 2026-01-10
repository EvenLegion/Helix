'use client';

import { EllipsisVertical, CircleUser, LogOut, AlertTriangle, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@workspace/ui/components/sidebar';
import { Button } from '@workspace/ui/components/button';
import { authClient } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function NavUser({
    user,
}: {
    user: {
        email: string;
        avatar: string;
        username: string;
    };
}) {
    const { isMobile } = useSidebar();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedUser, setImpersonatedUser] = useState<{
        id: string;
        name?: string;
        email?: string;
        username?: string;
    } | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const { data: session } = authClient.useSession();

    // Check impersonation status
    useEffect(() => {
        if (!mounted || !session) return;

        const impersonatedBy =
            session.session?.impersonatedBy ||
            (session.session as any)?.impersonatedBy ||
            (session as any)?.impersonatedBy;

        if (impersonatedBy && session.user) {
            setIsImpersonating(true);
            setImpersonatedUser({
                id: session.user.id,
                name: session.user.name || undefined,
                email: session.user.email || undefined,
                // @ts-expect-error user.nickname and username are valid properties
                username: (session.user.nickname ?? session.user.username) || undefined,
            });
        } else {
            setIsImpersonating(false);
            setImpersonatedUser(null);
        }
    }, [mounted, session]);

    const handleStopImpersonation = async () => {
        setIsLoading(true);
        try {
            await authClient.admin.stopImpersonating();
            toast.success('Stopped impersonating user');
            router.refresh();
            window.location.reload();
        } catch (error) {
            console.error('Failed to stop impersonation:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to stop impersonation');
        } finally {
            setIsLoading(false);
        }
    };

    const onSignOut = async () => {
        await authClient.signOut();
    };

    return (
        <SidebarMenu>
            {/* Impersonation Banner */}
            {mounted && isImpersonating && impersonatedUser && (
                <div className="mb-2 mx-2 p-2 bg-amber-500/10 dark:bg-amber-600/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-500 truncate">
                                Impersonating:{' '}
                                {impersonatedUser.username || impersonatedUser.name || impersonatedUser.email}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleStopImpersonation}
                        disabled={isLoading}
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs border-amber-500/30 hover:bg-amber-500/20"
                    >
                        {isLoading ? (
                            <>Stopping...</>
                        ) : (
                            <>
                                <X className="h-3 w-3 mr-1" />
                                Stop Impersonating
                            </>
                        )}
                    </Button>
                </div>
            )}

            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={(props) => (
                            <SidebarMenuButton
                                {...props}
                                size={'lg'}
                                className={
                                    'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                                }
                            >
                                <Avatar className={'h-8 w-8 rounded-lg'}>
                                    <AvatarImage src={user.avatar} alt={user.username} />
                                    <AvatarFallback className={'rounded-lg'}>CN</AvatarFallback>
                                </Avatar>
                                <div className={'grid flex-1 text-left text-sm leading-tight'}>
                                    <span className={'truncate font-medium'}>{user.username}</span>
                                    <span className={'text-muted-foreground truncate text-xs'}>{user.email}</span>
                                </div>
                                <EllipsisVertical className={'ml-auto size-4'} />
                            </SidebarMenuButton>
                        )}
                    />
                    <DropdownMenuContent
                        className={'w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'}
                        side={isMobile ? 'bottom' : 'right'}
                        align={'end'}
                        sideOffset={4}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className={'p-0 font-normal'}>
                                <div className={'flex items-center gap-2 px-1 py-1.5 text-left text-sm'}>
                                    <Avatar className={'h-8 w-8 rounded-lg'}>
                                        <AvatarImage src={user.avatar} alt={user.username} />
                                        <AvatarFallback className={'rounded-lg'}>CN</AvatarFallback>
                                    </Avatar>
                                    <div className={'grid flex-1 text-left text-sm leading-tight'}>
                                        <span className={'truncate font-medium'}>{user.username}</span>
                                        <span className={'text-muted-foreground truncate text-xs'}>{user.email}</span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={onSignOut}>
                                <LogOut />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
