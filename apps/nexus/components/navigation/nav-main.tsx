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
} from "@workspace/ui/components/collapsible";
import { type LucideIcon } from 'lucide-react';
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
            // Exact match for admin routes
            if (url === '/' && pathName === '/') return true

            // For other routes, check if the pathname starts with the url
            if (url !== '/') {

                if (pathName === url) return true

                // Check URL Segments
                const pathSegments = pathName.split('/').filter(Boolean);
                const urlSegments = url.split('/').filter(Boolean);

                // Ensure the URL segments are a prefix of the path segments
                if (pathSegments.length === urlSegments.length + 1 &&
                    pathName.startsWith(url + '/')) {
                    return true;
                }
            }
            return false
        }

    return (
        <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
                <SidebarGroupLabel>Home</SidebarGroupLabel>
                <SidebarGroupContent className="flex flex-col gap-2">
                    <SidebarMenu>
                        {items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton tooltip={item.title} isActive={isActive(item.url)} render={<Link href={item.url} />}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </Collapsible>
    )
}
