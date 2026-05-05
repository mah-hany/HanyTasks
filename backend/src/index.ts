import 'dotenv/config';
import app from './app';
import { createServer } from 'http';
import { initSocket } from './socket';
import { logger } from './utils/logger';
import { startSchedulers } from './schedulers';
import { initTelegramBot } from './modules/telegram/telegram.bot';
import prisma from './prisma/client';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Test DB connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    const httpServer = createServer(app);
    initSocket(httpServer);
    startSchedulers();
    initTelegramBot();

    httpServer.listen(PORT, () => {
      logger.info(`🚀 TaskFlow Pro API running on port ${PORT}`);
      logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
