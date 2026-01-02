import { getCurrentUser } from '@/server/users'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent
} from '@workspace/ui/components/card'

import { isAdmin } from '@/server/permissions'

export default async function Dashboard() {
    // Check if user is a site admin
    const hasPermission = await isAdmin();

    if (!hasPermission) {
        return (
            <div className="min-h-svh p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have permission to access this page. Only site administrators can access the admin dashboard.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { currentUser } = await getCurrentUser();


    // TODO: Make page uniformed create subpage for organizations and roles
    return (
        <>
        <div className="min-h-svh p-4">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Welcome {(currentUser?.nickname ? currentUser?.nickname : currentUser?.username)?.split('|').pop()?.trim()}!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        You are logged in as {currentUser?.email}. Use the sidebar to navigate through the admin dashboard.
                    </p>
                </CardContent>
            </Card>
        </div>
        </>
    )
}
