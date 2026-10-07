import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient. Next.js dev hot-reload re-evaluates modules, which
// would otherwise spawn a new connection pool on every reload and exhaust
// Postgres connections. Caching on globalThis in non-production keeps a single
// client across reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
