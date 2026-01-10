import { PrismaClient } from '../generated/prisma/index.js'
import { withAccelerate } from '@prisma/extension-accelerate'

const createPrismaClient = () => new PrismaClient().$extends(withAccelerate());

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = global as unknown as { prisma: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
