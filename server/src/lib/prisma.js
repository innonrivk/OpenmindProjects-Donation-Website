import { PrismaClient } from '@prisma/client';
import { withEmailTrigger } from '../middleware/prismaEmailTrigger.js';

/**
 * Shared, singleton Prisma client extended with the email trigger middleware.
 *
 * Why a singleton? Multiple `new PrismaClient()` instances waste connection pool
 * slots and — critically — bypass the $extends middleware registered here.
 * Every route that performs DB writes MUST import from this module so that
 * the email trigger fires consistently on every create operation.
 */
let dbUrl = process.env.DATABASE_URL || 'postgresql://omp_user:omp_dev_password@localhost:5432/omp_database';
if (process.env.NODE_ENV === 'test' && dbUrl.includes('/omp_database')) {
  dbUrl = dbUrl.replace('/omp_database', '/omp_test');
}

const basePrisma = withEmailTrigger(new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
}));

const prisma = basePrisma.$extends({
  query: {
    user: {
      async delete({ args, query }) {
        // Fetch the user before deletion to check if they are protected
        const target = await basePrisma.user.findUnique({
          where: args.where,
          select: { isProtected: true },
        });
        if (target?.isProtected) {
          // Silent no-op: return target instead of executing actual delete
          return target;
        }
        return query(args);
      },
      async deleteMany({ args, query }) {
        // Exclude protected users from bulk deletes
        return query({
          ...args,
          where: { ...args.where, isProtected: false },
        });
      },
    },
  },
});

export default prisma;
