import { Card, CardHeader, CardTitle, CardContent } from '@workspace/ui/components/card';
import { checkPermissions } from '@/server/permissions';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getAllApplications } from '@/server/recruitment';
import { ApplicationsTable } from '@/components/recruitment/applications-table';
import Link from 'next/link';
import { Button } from '@workspace/ui/components/button';
import { ArrowLeft } from 'lucide-react';

export default async function ApplicationsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return (
            <div className="flex items-center justify-center min-h-svh">
                <Card className="w-96">
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You must be signed in to access the recruitment applications page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const hasPermission = await checkPermissions({
        recruitment: ['view'],
    });

    if (!hasPermission) {
        return (
            <div className="flex items-center justify-center min-h-svh">
                <Card className="w-96">
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have permission to access the recruitment applications page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const applications = await getAllApplications();

    return (
        <div className="min-h-svh p-4">
            <Card className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            nativeButton={false}
                            render={
                                <Link href="/recruitment/admin">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Dashboard
                                </Link>
                            }
                        />
                        <CardTitle>Recruitment Applications</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <ApplicationsTable applications={applications} />
                </CardContent>
            </Card>
        </div>
    );
}
