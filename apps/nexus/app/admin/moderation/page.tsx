import { getCurrentUser } from '@/server/users';
import { checkPermissions } from '@/server/permissions';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent
} from '@workspace/ui/components/card';

export default async function Moderation() {
    // Check if user has permission to access this page
    const hasPermission = await checkPermissions({
        admin: ['admin_dashboard']
    });

    if (!hasPermission) {
        return (
            <div className="min-h-svh p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have permission to access this page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { currentUser } = await getCurrentUser();

    return (
        <div className="min-h-svh p-4">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Moderation Tools</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Moderation tools will be available here.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
