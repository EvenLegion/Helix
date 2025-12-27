import { UserDAL } from '@/dal/users';
import { Card, CardHeader, CardTitle, CardContent } from '@workspace/ui/components/card';
import { UsersTable } from '@/components/admin/users-table';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function Users() {
    // Check if user has permission to view all users
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
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

    const canViewUsers = await auth.api.userHasPermission({
        body: {
            userId: session.user.id,
            permissions: { user: ['list']}
        },
        headers: await headers()
    });

    // Check the success property of the response object
    if (!canViewUsers?.success) {
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

