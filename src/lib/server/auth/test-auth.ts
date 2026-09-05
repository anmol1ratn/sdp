const testUserHeader = 'x-test-user-id';

export interface TestSession {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function getTestSession(options: {
  enabled: boolean;
  development: boolean;
  headers: Headers;
}): TestSession | null {
  if (!options.enabled || !options.development) return null;

  const userId = options.headers.get(testUserHeader);
  if (!userId) return null;

  const now = new Date(0);
  return {
    session: {
      id: `test-session-${userId}`,
      token: 'test-only-token',
      userId,
      expiresAt: new Date('2999-01-01T00:00:00.000Z'),
      createdAt: now,
      updatedAt: now
    },
    user: {
      id: userId,
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      createdAt: now,
      updatedAt: now
    }
  };
}
