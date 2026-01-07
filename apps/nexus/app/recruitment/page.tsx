'use client';

import { Button } from '@workspace/ui/components/button';
import { Card, CardHeader, CardContent } from '@workspace/ui/components/card';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export default function Recruitment() {
    const router = useRouter();
    const { data: session } = authClient.useSession();

    const handleApplyClick = async () => {
        if (!session) {
            // Not signed in - trigger Discord OAuth with callback to application page
            await authClient.signIn.social({
                provider: 'discord',
                callbackURL: '/recruitment/application',
            });
        } else {
            // Already signed in - go directly to application
            router.push('/recruitment/application');
        }
    };

    return (
        <>
            <div className="min-h-svh p-4">
                <Card className="w-full">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium">Welcome to our Recruitment Page</h2>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4">
                            Placeholder content for the recruitment page. Here you can find information about job
                            openings and how to apply.
                        </p>
                    </CardContent>
                </Card>
                <div className="mt-4">
                    <Card className="w-1/2">
                        <CardHeader>Interested in joining our org?</CardHeader>
                        <CardContent>
                            <Button onClick={handleApplyClick}>Apply Now</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
