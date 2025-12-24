"use client"

import * as React from 'react';
import Image from 'next/image';

import { LogIn } from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@workspace/ui/components/sidebar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { NavGroup } from "@/components/navigation/nav-group";
import { NavUser } from "@/components/navigation/nav-user";
import { authClient } from "@/lib/auth-client";
import { getMenuItemsByGroup } from "@/lib/menu-config";
import { filterMenuItems } from "@/lib/utils/filter-menu-items";
import { checkPermissions } from "@/server/permissions";

const data = {
    navMain: getMenuItemsByGroup('navMain'),
    navAdmin: getMenuItemsByGroup('navAdmin'),
    navAuthenticated: getMenuItemsByGroup('navAuthenticated'),
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { data: session, isPending } = authClient.useSession();
    const { data: activeOrg } = authClient.useActiveOrganization();

    const hasActiveOrg = !!activeOrg;

    // State for filtered menu items
    const [filteredNavMain, setFilteredNavMain] = React.useState<typeof data.navMain>([]);
    const [filteredNavAuthenticated, setFilteredNavAuthenticated] = React.useState<typeof data.navAuthenticated>([]);
    const [filteredNavAdmin, setFilteredNavAdmin] = React.useState<typeof data.navAdmin>([]);
    const [isFiltering, setIsFiltering] = React.useState(true);

    // Permission checking function using server action
    const hasPermission = React.useCallback(async (permissions: Record<string, string[]>): Promise<boolean> => {
        if (!session?.user) {
            return false;
        }

        return checkPermissions(permissions);
    }, [session?.user]);

    // Filter menu items based on conditions (including permissions)
    React.useEffect(() => {
        const filterItems = async () => {
            setIsFiltering(true);
            try {
                const context = {
                    hasActiveOrg,
                    hasPermission,
                };

                const [main, authenticated, admin] = await Promise.all([
                    filterMenuItems(data.navMain, context),
                    filterMenuItems(data.navAuthenticated, context),
                    filterMenuItems(data.navAdmin, context),
                ]);

                setFilteredNavMain(main);
                setFilteredNavAuthenticated(authenticated);
                setFilteredNavAdmin(admin);
            } catch (error) {
                console.error('Error filtering menu items:', error);
                // On error, show no items for security
                setFilteredNavMain([]);
                setFilteredNavAuthenticated([]);
                setFilteredNavAdmin([]);
            } finally {
                setIsFiltering(false);
            }
        };

        // Always filter items - the filter logic handles authentication state
        // Items with condition: ({ hasActiveOrg }) => !hasActiveOrg will show when not authenticated
        filterItems();
    }, [hasActiveOrg, hasPermission, session?.user]);

    const onSignIn = async () => {
        await authClient.signIn.social({
            provider: "discord",
        });
    };

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            className="data-[slot=sidebar-menu-button]:!p-1.5 w-full"
                            render={(props) => (
                                <a {...props} href="#">
                                    <Image src="/logo.svg" alt="Even Legion" width={24} height={24} className="!size-6" />
                                    <span className="text-base font-semibold">Even Legion</span>
                                </a>
                            )}
                        />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                {(isPending || isFiltering) ? (
                    // Show skeleton loading state
                    <div className="flex flex-col gap-4 p-2">
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-20" />
                            <div className="flex flex-col gap-1">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-3/4" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Render main navigation (Welcome, Recruitment) when no active org */}
                        {filteredNavMain.length > 0 && (
                            <NavGroup items={filteredNavMain} />
                        )}

                        {/* Render authenticated navigation (Dashboard) when in org */}
                        {filteredNavAuthenticated.length > 0 && (
                            <NavGroup items={filteredNavAuthenticated} />
                        )}

                        {/* Render admin navigation when in org */}
                        {filteredNavAdmin.length > 0 && (
                            <NavGroup title="Administration" items={filteredNavAdmin} />
                        )}
                    </>
                )}
            </SidebarContent>
            <SidebarFooter>
                {isPending ? (
                    // Show skeleton for user profile loading
                    <div className="flex h-full w-full items-center justify-center p-2">
                        <div className="flex w-full items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <div className="flex flex-1 flex-col gap-1">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-4 w-4" />
                        </div>
                    </div>
                ) : session?.user ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <NavUser user={{
                            email: session.user.email ?? '',
                            // @ts-expect-error user.nickname is a valid property
                            username: session.user.nickname ?? session.user.username,
                            avatar: session.user.image ?? 'https://github.com/shadcn.png'
                        }} />
                    </div>
                ) : (
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                className="data-[slot=sidebar-menu-button]:!p-1.5"
                                onClick={onSignIn}
                            >
                                <LogIn className="!size-4" />
                                Sign In
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                )}
            </SidebarFooter>
        </Sidebar>
    )
}
