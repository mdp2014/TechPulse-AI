import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import { logSystem } from './db/index.js';
import { subscriptionRouter } from './routes/subscription.js';
import { editionsRouter } from './routes/editions.js';
import { adminRouter } from './routes/admin.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';

const app = express();

// Security and standard middlewares
app.use(helmet({
  contentSecurityPolicy: false // Allow loading CDN Tailwind / fonts for the web UI
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const publicDir = path.resolve(config.rootDir, 'src/public');
app.use(express.static(publicDir));

// API and web routes
app.use('/api', subscriptionRouter);
app.use(editionsRouter);
app.use(adminRouter);

// Fallback error handler
app.use((err, req, res, next) => {
  logSystem('error', 'server', `Unhandled HTTP error: ${err.message}`, { stack: err.stack, path: req.path });
  res.status(500).json({ success: false, error: 'Une erreur interne est survenue.' });
});

// Start HTTP server and scheduler
const server = app.listen(config.port, () => {
  logSystem('info', 'server', `${config.appName} server running at ${config.baseUrl} (Port ${config.port}, Env: ${config.env})`);
  
  // Start the background cron scheduler
  startScheduler();
});

// Graceful shutdown
function gracefulShutdown(signal) {
  logSystem('info', 'server', `Received ${signal}, shutting down gracefully...`);
  stopScheduler();
  server.close(() => {
    logSystem('info', 'server', 'HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 5 seconds if hanging
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
