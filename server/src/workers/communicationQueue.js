import { Queue, Worker } from 'bullmq';
import { sendTemplatedEmail } from '../services/email.js';
import prisma from '../lib/prisma.js';

const redisUrl = process.env.REDIS_URL;
let queue = null;
let worker = null;

// Determine if we should attempt Redis connection
const useRedis = !!redisUrl;

if (useRedis) {
  try {
    queue = new Queue('comms', { connection: redisUrl });
    queue.on('error', (err) => {
      console.warn('⚠️ BullMQ Queue Connection Error:', err.message);
    });

    worker = new Worker('comms', async (job) => {
      const { type, payload } = job.data;
      if (type === 'DISPATCH_EMAIL') {
        try {
          await sendTemplatedEmail(payload.to, payload.template, payload.context);
          await prisma.dispatchLog.update({
            where: { id: payload.logId },
            data: { status: 'SENT' },
          });
        } catch (err) {
          await prisma.dispatchLog.update({
            where: { id: payload.logId },
            data: { status: 'FAILED', errorMessage: err.message },
          });
          throw err; // Re-throw for BullMQ retry
        }
      }
    }, {
      connection: redisUrl,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    });

    worker.on('error', (err) => {
      console.warn('⚠️ BullMQ Worker Connection Error:', err.message);
    });
  } catch (err) {
    console.warn('⚠️ Failed to initialize BullMQ with Redis, falling back to in-memory dispatch:', err.message);
    queue = null;
    worker = null;
  }
}

export const communicationQueue = {
  add: async (name, data) => {
    if (queue) {
      try {
        return await queue.add(name, data);
      } catch (err) {
        console.warn('⚠️ BullMQ add failed, falling back to direct execution:', err.message);
      }
    }

    // Fallback: direct asynchronous dispatch
    const { type, payload } = data;
    if (type === 'DISPATCH_EMAIL') {
      setImmediate(async () => {
        try {
          await sendTemplatedEmail(payload.to, payload.template, payload.context);
          await prisma.dispatchLog.update({
            where: { id: payload.logId },
            data: { status: 'SENT' },
          });
        } catch (err) {
          await prisma.dispatchLog.update({
            where: { id: payload.logId },
            data: { status: 'FAILED', errorMessage: err.message },
          });
        }
      });
    }
  },
};
