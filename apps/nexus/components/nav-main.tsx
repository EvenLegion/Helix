import {
    SidebarGroupContent,
    SidebarMenu,
    SidebarGroup,
    SidebarMenuItem,
    SidebarMenuButton
} from "@workspace/ui/components/sidebar";
import { type LucideIcon } from 'lucide-react';


export function NavMain({
    items,
}: {
    items: {
        title: string;
        url: string;
        icon?: LucideIcon
    }[]
}) {
    return (
        <SidebarGroup>
            <SidebarGroupContent className="flex flex-col gap-2">
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton tooltip={item.title}>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}