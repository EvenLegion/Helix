import type { MenuItem, MenuItemContext } from "@/lib/menu-config";

/**
 * Filters menu items based on their condition functions and requiredPermissions
 * @param items Array of menu items to filter
 * @param context Context object passed to condition functions
 * @returns Promise that resolves to filtered array of menu items that pass their conditions
 */
export async function filterMenuItems(
    items: MenuItem[],
    context: MenuItemContext
): Promise<MenuItem[]> {
    const results = await Promise.all(
        items.map(async (item) => {
            // First check custom condition if provided
            if (item.condition) {
                try {
                    const result = item.condition(context);
                    const shouldShow = result instanceof Promise ? await result : result;
                    if (!shouldShow) {
                        return { item, shouldShow: false };
                    }
                } catch (error) {
                    console.error(`Error evaluating condition for menu item "${item.title}":`, error);
                    return { item, shouldShow: false };
                }
            }

            // Check if active org is required
            if (item.requiresActiveOrg && !context.hasActiveOrg) {
                return { item, shouldShow: false };
            }

            // Check requiredPermissions if specified
            if (item.requiredPermissions) {
                try {
                    const hasPerms = await context.hasPermission(item.requiredPermissions);
                    if (!hasPerms) {
                        return { item, shouldShow: false };
                    }
                } catch (error) {
                    console.error(`Error checking permissions for menu item "${item.title}":`, error);
                    return { item, shouldShow: false };
                }
            }

            return { item, shouldShow: true };
        })
    );

    return results.filter(({ shouldShow }) => shouldShow).map(({ item }) => item);
}

