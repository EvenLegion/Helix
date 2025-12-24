import { UserDAL } from '@/dal/users';
import { Card, CardHeader, CardTitle, CardContent } from '@workspace/ui/components/card';
import { checkPermissions } from '@/server/permissions';
import { UsersTable } from '@/components/admin/users-table';

export default async function Users() {
    // Check if user has permission to view all users
    const canViewUsers = await checkPermissions({
        admin: ['admin_dashboard']
    });

    if (!canViewUsers) {
        return (
            <div className="min-h-svh p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have permission to view this page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Fetch all users from the database
    const users = await UserDAL.findAll();

    return (
        <div className="min-h-svh p-4">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent>
                    <UsersTable users={users} />
                </CardContent>
            </Card>
        </div>
    );
}

