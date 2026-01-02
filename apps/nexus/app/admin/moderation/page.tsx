import { getCurrentUser } from '@/server/users';
import { isAdmin } from '@/server/permissions';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent
} from '@workspace/ui/components/card';

export default async function Moderation() {
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
                        <p>You do not have permission to access this page. Only site administrators can access moderation tools.</p>
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
