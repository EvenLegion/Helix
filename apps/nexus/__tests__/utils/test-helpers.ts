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

export async function createTestSetup(role: string = 'owner') {
    const user = await createTestUser();
    const org = await createTestOrganization();
    const member = await createTestMember(user.id, org.id, role);

    return { user, org, member };
}

export async function cleanupTestData() {
    // Delete audit logs first (before users are deleted due to foreign key)
    // Only delete audit logs related to test users or test organizations
    await prisma.auditLog.deleteMany({
        where: {
            OR: [
                { userId: { startsWith: 'test-user-' } },
                { organizationId: { startsWith: 'test-org-' } },
            ],
        },
    });

    await prisma.member.deleteMany({
        where: { userId: { startsWith: 'test-user-' } },
    });

    await prisma.organizationRole.deleteMany({
        where: { organizationId: { startsWith: 'test-org-' } },
    });

    await prisma.organization.deleteMany({
        where: { id: { startsWith: 'test-org-' } },
    });

    await prisma.user.deleteMany({
        where: { id: { startsWith: 'test-user-' } },
    });
}
