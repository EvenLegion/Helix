import { House, UserStar, Shield, Building2, Users } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

export interface MenuItemContext {
    hasActiveOrg: boolean;
    // Function to check if user has specific permissions
    // Returns a promise that resolves to true if user has the permissions
    hasPermission: (permissions: Record<string, string[]>) => Promise<boolean>;
    // User's admin role (from better-auth admin plugin)
    userRole?: string | null;
}

export interface MenuItem {
    title: string;
    url: string;
    icon?: LucideIcon;
    // Require active organization to show this item
    requiresActiveOrg?: boolean;
    // Optional: require specific permissions to see this item
    // Format: { category: ['permission1', 'permission2'] }
    // Example: { member: ['create'] } or { admin: ['admin_dashboard'] }
    requiredPermissions?: Record<string, string[]>;
    // Optional custom condition function for complex logic
    // Receives context with hasActiveOrg and hasPermission function
    // Return true to show the item, false to hide it
    // Can be async if you need to check permissions
    condition?: (context: MenuItemContext) => boolean | Promise<boolean>;
}

export interface MenuGroup {
    title: string;
    items: MenuItem[];
}

// Page-specific header titles (optional overrides)
export const pageHeaders: Record<string, string> = {
    '/admin/organizations': 'Organization Management',
    '/admin/users': 'User Management',
    '/admin/dashboard': 'Admin Dashboard',
    '/admin/moderation': 'Moderation Tools',
    // Add more custom titles as needed
};

export const menuItems = {
    // Navigation items for users not in an organization
    navMain: [
        {
            title: 'Welcome',
            url: '/',
            icon: House,
            condition: ({ hasActiveOrg }: MenuItemContext) => !hasActiveOrg,
        },
        {
            title: 'Recruitment',
            url: '/recruitment',
            icon: House,
            condition: ({ hasActiveOrg }: MenuItemContext) => !hasActiveOrg,
        },
    ],
    // Navigation items for users in an organization
    navAuthenticated: [
        {
            title: 'Dashboard',
            url: '/dashboard',
            icon: House,
            requiresActiveOrg: true,
            // No permissions required, just needs to be in org
        }
    ],
    // Admin navigation items (shown only when in organization and with proper permissions)
    navAdmin: [
        {
            title: 'Dashboard',
            url: '/admin/dashboard',
            icon: UserStar,
            requiresActiveOrg: false,
            condition: async (context: MenuItemContext) => {
                // Check if user has admin role
                try {
                    // Only admins can see the admin dashboard
                    if (context.userRole === 'admin') {
                        return true;
                    }

                    return false;
                } catch (error) {
                    console.error('Error checking permissions for Dashboard menu:', error);
                    return false;
                }
            },
        },
        {
            title: 'Moderation',
            url: '/admin/moderation',
            icon: Shield,
            requiresActiveOrg: false,
            condition: async (context: MenuItemContext) => {
                // Check if user has admin role OR moderator role
                try {
                    // Admins and moderators can see the moderation page
                    if (context.userRole === 'admin' || context.userRole === 'moderator') {
                        return true;
                    }

                    return false;
                } catch (error) {
                    console.error('Error checking permissions for Moderation menu:', error);
                    return false;
                }
            },
        },
        {
            title: 'Organizations',
            url: '/admin/organizations',
            icon: Building2,
            requiresActiveOrg: false,
            condition: async (context: MenuItemContext) => {
                // Check if user has admin role OR member:read permission (organization)
                try {
                    // First check if user has admin role
                    if (context.userRole === 'admin') {
                        return true;
                    }

                    // Otherwise, check organization permission
                    const hasOrgPermission = await context.hasPermission({ member: ['read'] });
                    return hasOrgPermission;
                } catch (error) {
                    console.error('Error checking permissions for Organizations menu:', error);
                    return false;
                }
            },
        },
        {
            title: 'Users',
            url: '/admin/users',
            icon: Users,
            requiresActiveOrg: false,
            condition: async (context: MenuItemContext) => {
                // Check if user has admin role OR moderator role (both can access user management)
                try {
                    // Admins and moderators can see the Users page
                    if (context.userRole === 'admin' || context.userRole === 'moderator') {
                        return true;
                    }

                    return false;
                } catch (error) {
                    console.error('Error checking permissions for Users menu:', error);
                    return false;
                }
            },
        }
    ]
};

// Helper function to get all menu items as flat array
export function getAllMenuItems(): MenuItem[] {
    return Object.values(menuItems).flat() as MenuItem[]
}

// Helper function to get menu items by group
export function getMenuItemsByGroup(groupName: keyof typeof menuItems): MenuItem[] {
    return (menuItems[groupName] || []) as MenuItem[]
}

export function getMenuItemByPath(pathname: string): MenuItem | undefined {
    const allItems = getAllMenuItems()
    return allItems.find(item => {
        if (item.url === '/' && pathname === '/') return true
        if (item.url !== '/' && pathname.startsWith(item.url)) return true
        return false
    })
}

// Get page header title with fallback to menu item title
export function getPageHeader(pathname: string): string {
    // First check for page-specific override
    if (pageHeaders[pathname]) {
        return pageHeaders[pathname];
    }

    // Fall back to menu item title
    const menuItem = getMenuItemByPath(pathname);
    return menuItem?.title || 'Page';
}

// Alternative structure with group titles for more complex sidebar layouts
export const menuGroups: MenuGroup[] = [
    {
        title: "Navigation",
        items: menuItems.navMain
    },
]

