import { House, UserStar, Shield } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

export interface MenuItem {
    title: string;
    url: string;
    icon?: LucideIcon;
}

export interface MenuGroup {
    title: string;
    items: MenuItem[];
}

export const menuItems = {
    navMain: [
        {
            title: 'Home',
            url: '/',
            icon: House
        },
        {
            title: 'Dashboard',
            url: '/dashboard',
            icon: House
        },
    ],
    navAdmin: [
        {
            title: 'Dashboard',
            url: '/admin/dashboard',
            icon: UserStar
        },
        {
            title: 'Moderation',
            url: '/admin/moderation',
            icon: Shield
        }
    ]
};

// Helper function to get all menu items as flat array
export function getAllMenuItems(): MenuItem[] {
    return Object.values(menuItems).flat()
}

// Helper function to get menu items by group
export function getMenuItemsByGroup(groupName: keyof typeof menuItems): MenuItem[] {
    return menuItems[groupName] || []
}

export function getMenuItemByPath(pathname: string): MenuItem | undefined {
    const allItems = getAllMenuItems()
    return allItems.find(item => {
        if (item.url === '/' && pathname === '/') return true
        if (item.url !== '/' && pathname.startsWith(item.url)) return true
        return false
    })
}

// Alternative structure with group titles for more complex sidebar layouts
export const menuGroups: MenuGroup[] = [
    {
        title: "Navigation",
        items: menuItems.navMain
    },
]

