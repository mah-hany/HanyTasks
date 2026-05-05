import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'error' }]
    : [{ emit: 'event', level: 'error' }],
});

prisma.$on('error' as never, (e: any) => {
  logger.error('Prisma error:', e);
});

export default prisma;
