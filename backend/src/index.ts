import dotenv from 'dotenv';
// Load environment variables FIRST before importing routes
dotenv.config({ override: true });

import { installEpipeGuard } from './utils/epipeGuard';

import express from 'express';
import cors from 'cors';
import path from 'path';

// Import configuration
import { serverConfig } from './config';

// Import routes (now after dotenv.config())
import sqlRoutes from './routes/sql';
import simpleTraceRoutes from './routes/simpleTraceRoutes';
import perfettoLocalRoutes from './routes/perfettoLocalRoutes';
import perfettoSqlRoutes from './routes/perfettoSqlRoutes';
import exportRoutes from './routes/exportRoutes';
import skillRoutes from './routes/skillRoutes';
import skillAdminRoutes from './routes/skillAdminRoutes';
import flamegraphRoutes from './routes/flamegraphRoutes';
import criticalPathRoutes from './routes/criticalPathRoutes';
import baselineRoutes from './routes/baselineRoutes';
import memoryRoutes from './routes/memoryRoutes';
import traceRoutes from './routes/trace';
import traceProcessorRoutes from './routes/traceProcessorRoutes';
import { authenticate } from './middleware/auth';
import {
  assertTraceAnalysisConfiguredForStartup,
  getTraceAnalysisConfigurationStatus,
} from './services/traceAnalysisSkill';
import {
  AGENT_API_V1_BASE,
  AGENT_API_V1_LLM_BASE,
  LEGACY_AGENT_API_BASE,
  rejectLegacyAgentApi,
} from './middleware/legacyAgentApi';

// Import cleanup utilities
import { TraceProcessorFactory, killOrphanProcessors } from './services/workingTraceProcessor';
import { getProviderService } from './services/providerService';

const app = express();
const PORT = serverConfig.port;
const NODE_ENV = serverConfig.nodeEnv;

// Fail fast for trace-analysis-specific credentials when strict startup validation is enabled.
assertTraceAnalysisConfiguredForStartup();

// Middleware — dynamic CORS: allow any origin
app.use(cors({
  origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    if (!requestOrigin) return callback(null, true);
    try {
      const url = new URL(requestOrigin);
      if (url.port === '10000') {
        return callback(null, true);
      }
    } catch { /* malformed origin → block */ }
    callback(new Error(`CORS blocked: ${requestOrigin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: serverConfig.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: serverConfig.bodyLimit }));

// Health check endpoint
app.get('/health', (_req, res) => {
  const providerSvc = getProviderService();
  const activeProvider = providerSvc.list().find(p => p.isActive);

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '0.1.0',
    traceAnalysis: getTraceAnalysisConfigurationStatus(),
    aiEngine: {
      model: activeProvider?.models.primary || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      configured: activeProvider != null,
      source: activeProvider ? 'provider-manager' : 'env-fallback',
      ...(activeProvider ? {
        activeProvider: {
          id: activeProvider.id,
          name: activeProvider.name,
          type: activeProvider.type,
        },
      } : {}),
      authRequired: !!process.env.CAMERAPERF_API_KEY,
    },
  });
});

// API routes
app.use('/api/sql', sqlRoutes);
app.use('/api/traces', simpleTraceRoutes);
app.use('/api/perfetto', perfettoLocalRoutes);
app.use('/api/perfetto-sql', perfettoSqlRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/admin', skillAdminRoutes);
app.use('/api/flamegraph', flamegraphRoutes);
app.use('/api/critical-path', criticalPathRoutes);
app.use('/api/baselines', baselineRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/trace', traceRoutes);
app.use('/api/trace-processor', traceProcessorRoutes);
app.use(LEGACY_AGENT_API_BASE, rejectLegacyAgentApi);

const assistantShellDir = path.resolve(__dirname, '../public/assistant-shell');
app.get('/assistant-shell', (_req, res) => {
  res.sendFile(path.join(assistantShellDir, 'index.html'));
});
app.use('/assistant-shell', express.static(assistantShellDir));

// Serve uploaded files in development
if (NODE_ENV === 'development') {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Initialize services
killOrphanProcessors();

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
  console.log(`\n📴 Received ${signal}, shutting down gracefully...`);
  TraceProcessorFactory.cleanup();
  console.log('✅ Cleanup complete, exiting...');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

installEpipeGuard((error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 CameraPerf server running on port ${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

server.on('close', () => {
  console.log('🔒 Server closed');
});
