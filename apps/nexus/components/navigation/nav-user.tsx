"use client"

import { EllipsisVertical, CircleUser, LogOut } from "lucide-react";
import {
    Avatar,
    AvatarFallback,
    AvatarImage
} from "@workspace/ui/components/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@workspace/ui/components/dropdown-menu";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@workspace/ui/components/sidebar";
import { authClient } from "@/lib/auth-client";

export function NavUser({
    user,
}: {
    user: {
        email: string
        avatar: string
        username: string
    }
}) {
    const { isMobile } = useSidebar()

    const onSignOut = async () => {
        await authClient.signOut();
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger render={(props) => (
                        <SidebarMenuButton
                            {...props}
                            size={"lg"}
                            className={"data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"}
                            >
                            <Avatar className={"h-8 w-8 rounded-lg"}>
                                <AvatarImage src={user.avatar} alt={user.username} />
                                <AvatarFallback className={"rounded-lg"}>CN</AvatarFallback>
                            </Avatar>
                            <div className={"grid flex-1 text-left text-sm leading-tight"}>
                                <span className={"truncate font-medium"}>{user.username}</span>
                                <span className={"text-muted-foreground truncate text-xs"}>{user.email}</span>
                            </div>
                            <EllipsisVertical className={"ml-auto size-4"} />
                        </SidebarMenuButton>
                    )} />
                    <DropdownMenuContent
                        className={"w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"}
                        side={isMobile ? "bottom" : "right"}
                        align={"end"}
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className={"p-0 font-normal"}>
                            <div className={"flex items-center gap-2 px-1 py-1.5 text-left text-sm"}>
                                <Avatar className={"h-8 w-8 rounded-lg"}>
                                    <AvatarImage src={user.avatar} alt={user.username} />
                                    <AvatarFallback className={"rounded-lg"}>CN</AvatarFallback>
                                </Avatar>
                                <div className={"grid flex-1 text-left text-sm leading-tight"}>
                                    <span className={"truncate font-medium"}>{user.username}</span>
                                    <span className={"text-muted-foreground truncate text-xs"}>{user.email}</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem>
                                <CircleUser />
                                Account
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onSignOut}>
                                <LogOut />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
