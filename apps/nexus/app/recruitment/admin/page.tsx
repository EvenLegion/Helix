import { Card, CardHeader, CardTitle, CardContent } from '@workspace/ui/components/card';
import { checkPermissionsOrAdmin } from '@/server/permissions';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getRecruitmentStatistics } from '@/server/recruitment';
import { StatsCard } from '@/components/recruitment/stats-card';
import Link from 'next/link';
import { Button } from '@workspace/ui/components/button';

export default async function RecruitmentAdmin() {
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
                        <p>You must be signed in to access the recruitment admin page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const hasPermission = await checkPermissionsOrAdmin({
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
                        <p>You do not have permission to access the recruitment admin page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const stats = await getRecruitmentStatistics();

    return (
        <div className="min-h-svh p-4">
            <Card className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recruitment Dashboard</CardTitle>
                    <Button
                        nativeButton={false}
                        render={<Link href="/recruitment/admin/applications">View All Applications</Link>}
                    />
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatsCard
                            title="Total Members"
                            value={stats.totalMembers}
                            description="Current Organization Members"
                        />
                        <StatsCard
                            title="Pending Applications"
                            value={stats.pendingCount}
                            description="Applications awaiting review"
                        />
                        <StatsCard
                            title="Accepted (7 days)"
                            value={stats.acceptedLast7Days}
                            description="New recruits this week"
                        />
                        <StatsCard
                            title="Total Processed"
                            value={stats.totalProcessed}
                            description="Applications accepted and rejected"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
