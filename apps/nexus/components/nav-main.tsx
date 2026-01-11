import {
    SidebarGroupContent,
    SidebarMenu,
    SidebarGroup,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroupLabel,
} from "@workspace/ui/components/sidebar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { usePathname } from "next/navigation";
import Link from "next/link";

export function NavMain({
    items,
}: {
    items: {
        title: string;
        url: string;
        icon?: LucideIcon
    }[]
}) {

    const pathName = usePathname();

    const isActive = (url: string) => {
        if (url === '/' && pathName === '/') return true
        if (url !== '/' && pathName.startsWith(url)) return true
        return false
    }

    return (
        <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
                <SidebarGroupContent className="flex flex-col gap-2">
                    <SidebarMenu>
                        {items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    tooltip={item.title}
                                    isActive={isActive(item.url)}
                                    render={(props) => (
                                        <Link href={item.url} {...props}>
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                        </Link>
                                    )}
                                />
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </Collapsible>
    )
}
