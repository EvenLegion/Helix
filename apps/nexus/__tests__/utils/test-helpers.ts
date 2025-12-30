import { prisma } from "@workspace/db";
import type { User, Organization, Member } from "@workspace/db";

export async function createTestUser(data?: Partial<User>): Promise<User> {
    return prisma.user.create({
        data: {
            id: data?.id || `test-user-${Date.now()}`,
            username: data?.username || 'testuser',
            name: data?.name || 'Test User',
            email: data?.email || `test-${Date.now()}@example.com`,
            ...data,
        },
    });
}

export async function createTestOrganization(data?: Partial<Organization>): Promise<Organization> {
    return prisma.organization.create({
        data: {
            id: data?.id || `test-org-${Date.now()}`,
            name: data?.name || 'Test Organization',
            slug: data?.slug || `test-org-${Date.now()}`,
            ...data,
        },
    });
}

export async function createTestMember(
    userId: string,
    organizationId: string,
    role: string = 'user'
): Promise<Member> {
    return prisma.member.create({
        data: { userId, organizationId, role },
    });
}

// TODO: START HERE UPSTAIRS
export async function createTestSetup(role: string = 'owner') {
    const user = await createTestUser();
}
