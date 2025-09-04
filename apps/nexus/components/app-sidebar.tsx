"use client"

import * as React from 'react';
import { House, LogIn } from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@workspace/ui/components/sidebar";
import { IconInnerShadowTop } from "@tabler/icons-react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {authClient} from "@/lib/auth-client";

const data = {
    navMain: [
        {
            title: "Home",
            url: "#",
            icon: House,
        },
        {
            title: "Guides",
            url: "/guides",
            icon: House,
        }
    ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {

    const { data: session, isPending } = authClient.useSession();

    const onSignIn = async () => {
        await authClient.signIn.social({
            provider: "discord",
        });
    };

    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                            >
                            <a href="#">
                                <IconInnerShadowTop className="!size-5" />
                                <span className="text-base font-semibold">Even Legion</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
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