import axios from 'axios';
import crypto from 'crypto';
import prisma from '../../prisma/client';
import { logger } from '../../utils/logger';

export const webhookService = {
  async dispatch(eventType: string, payload: any) {
    try {
      const hooks = await prisma.webhook.findMany({
        where: { isActive: true }
      });

      const matchedHooks = hooks.filter(h => h.eventTypes.includes(eventType) || h.eventTypes.includes('ALL'));
      
      if (matchedHooks.length === 0) return;

      const dataString = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload
      });

      for (const hook of matchedHooks) {
        const headers: any = { 'Content-Type': 'application/json' };
        
        if (hook.secret) {
          const signature = crypto.createHmac('sha256', hook.secret).update(dataString).digest('hex');
          headers['X-Webhook-Signature'] = signature;
        }

        // Fire and forget
        axios.post(hook.url, dataString, { headers, timeout: 5000 }).catch(err => {
          logger.warn(`Webhook failed for URL ${hook.url}: ${err.message}`);
        });
      }
    } catch (err) {
      logger.error('Webhook dispatch error:', err);
    }
  }
};
