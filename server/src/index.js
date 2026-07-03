import './lib/env.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import publicRouter from './routes/public/index.js';
import adminRouter from './routes/admin/index.js';
import publicWebhooks from './routes/public/webhooks.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy headers (e.g. Nginx, Vite proxy) for correct client IP detection in rate limiting
app.set('trust proxy', 1);

// 1. Mount public raw Stripe webhooks BEFORE the global JSON parser middleware
app.use('/api/v1/public/webhooks', publicWebhooks);

// 2. Global body and cookie parsers
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// 3. Mount namespace routes
app.use('/api/v1/public', publicRouter);
app.use('/api/v1/admin', adminRouter);

// Health check endpoint (public/system monitoring)
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler — maps Prisma-specific codes to clean HTTP responses
app.use((err, req, res, next) => {
  // Prisma: Record not found (safety net for controllers that miss it)
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'not_found',
      message: err.meta?.cause || 'The requested resource was not found.',
    });
  }

  // Prisma: Unique constraint violation (concurrent duplicate writes)
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'conflict',
      message: `A resource with this ${err.meta?.target?.join(', ') || 'field'} already exists.`,
    });
  }

  console.error('❌ Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`   Public Content: http://localhost:${PORT}/api/v1/public/content`);
  console.log(`   Public Auth: http://localhost:${PORT}/api/v1/public/auth`);
  console.log(`   Admin Auth: http://localhost:${PORT}/api/v1/admin/auth\n`);
});
// Watch reload trigger

