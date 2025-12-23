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
import { NavMain } from "@/components/navigation/nav-main";
import { NavUser } from "@/components/navigation/nav-user";
import { NavAdmin } from "@/components/navigation/nav-admin";
import { authClient } from "@/lib/auth-client";
import { getMenuItemsByGroup } from "@/lib/menu-config";
const data = {
    navMain: getMenuItemsByGroup('navMain'),
    navAdmin: getMenuItemsByGroup('navAdmin'),
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { data: session, isPending } = authClient.useSession();

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
                <NavMain items={data.navMain} />
                <NavAdmin items={data.navAdmin} />
            </SidebarContent>
            <SidebarFooter>
                {isPending ? (
                    <div className="flex h-full w-full items-center justify-center">Loading...</div>
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
