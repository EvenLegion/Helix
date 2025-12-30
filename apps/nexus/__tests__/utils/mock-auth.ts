import { vi } from 'vitest';

/**
 * Creates a mock auth session for testing
 */
export function createMockSession(user: any, activeOrganizationId: string | null = null) {
    return {
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
        },
        session: {
            id: 'test-session',
            userId: user.id,
            expiresAt: new Date(Date.now() + 86400000),
            token: 'test-token',
            activeOrganizationId,
        },
    };
}

/**
 * Mocks the auth module's getSession method
 */
export function mockAuthSession(user: any, activeOrganizationId: string | null = null) {
    const mockSession = createMockSession(user, activeOrganizationId);

    return vi.doMock('@/lib/auth', () => ({
        auth: {
            api: {
                getSession: vi.fn().mockResolvedValue(mockSession),
                userHasPermission: vi.fn().mockResolvedValue({ success: true }),
            },
        },
    }));
}