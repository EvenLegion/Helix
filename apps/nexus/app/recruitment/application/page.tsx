import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ApplicationForm } from '@/components/recruitment/application-form';

export default async function RecruitmentApplication() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        // TODO: Redirect to login and then return
        // If not authenticated, redirect to recruitment page
        redirect('/recruitment');
    }

    if (session) {
        // Check to see if they are already in an organization
        const userOrgs = await auth.api.listOrganizations({
            headers: await headers(),
        });

        if (userOrgs && userOrgs.length > 0) {
            // User is already in an organization, redirect to dashboard page
            redirect('/');
        }
    }

    return (
        <div>
            <ApplicationForm session={session} />
        </div>
    );
}
