import { Queue, Worker } from 'bullmq';
import { sendTemplatedEmail } from '../services/email.js';
import prisma from '../lib/prisma.js';

const redisUrl = process.env.REDIS_URL;
let queue = null;
let worker = null;

// Determine if we should attempt Redis connection
const useRedis = !!redisUrl;

async function updateDispatchLogStatus(dispatchId) {
  try {
    const recipients = await prisma.dispatchRecipient.findMany({
      where: { dispatchId },
      select: { status: true },
    });
    if (recipients.length === 0) return;
    const sentCount = recipients.filter((r) => r.status === 'SENT').length;
    const failCount = recipients.filter((r) => r.status === 'FAILED').length;
    const queuedCount = recipients.filter((r) => r.status === 'QUEUED').length;

    let status = 'QUEUED';
    if (queuedCount === 0) {
      if (failCount === 0) {
        status = 'SENT';
      } else if (sentCount === 0) {
        status = 'FAILED';
      } else {
        status = 'PARTIAL';
      }
    } else {
      if (sentCount > 0 || failCount > 0) {
        status = 'PARTIAL';
      }
    }

    await prisma.dispatchLog.update({
      where: { id: dispatchId },
      data: {
        status,
        errorMessage: failCount > 0 ? `${failCount} failed` : null,
      },
    });
  } catch (err) {
    console.error('Failed to update dispatch log status:', err.message);
  }
}

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
          await prisma.dispatchRecipient.updateMany({
            where: { dispatchId: payload.logId, email: payload.to },
            data: { status: 'SENT' },
          });
          await updateDispatchLogStatus(payload.logId);
        } catch (err) {
          await prisma.dispatchRecipient.updateMany({
            where: { dispatchId: payload.logId, email: payload.to },
            data: { status: 'FAILED', errorReason: err.message || 'SMTP dispatch failed' },
          });
          await updateDispatchLogStatus(payload.logId);
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
const fallbackQueue = [];
let processingFallback = false;

async function processFallbackQueue() {
  if (processingFallback || fallbackQueue.length === 0) return;
  processingFallback = true;

  try {
    while (fallbackQueue.length > 0) {
      const job = fallbackQueue[0];
      const { type, payload } = job;
      if (type === 'DISPATCH_EMAIL') {
        try {
          await sendTemplatedEmail(payload.to, payload.template, payload.context);
          await prisma.dispatchRecipient.updateMany({
            where: { dispatchId: payload.logId, email: payload.to },
            data: { status: 'SENT' },
          });
          await updateDispatchLogStatus(payload.logId);
        } catch (err) {
          await prisma.dispatchRecipient.updateMany({
            where: { dispatchId: payload.logId, email: payload.to },
            data: { status: 'FAILED', errorReason: err.message || 'SMTP dispatch failed' },
          });
          await updateDispatchLogStatus(payload.logId);
        }
      }
      fallbackQueue.shift(); // Remove job only after it is fully processed
    }
  } finally {
    processingFallback = false;
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

    // Fallback: queue jobs sequentially to prevent SQLite database lock concurrency conflicts
    fallbackQueue.push(data);
    setImmediate(processFallbackQueue);
  },
  isEmpty: () => fallbackQueue.length === 0 && !processingFallback,
};
