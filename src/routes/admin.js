import express from 'express';
import { db, subscribersDb, editionsDb, logSystem } from '../db/index.js';
import { executeMorningCycle, executeAfternoonCycle } from '../services/scheduler.js';
import { crawlAllFeeds } from '../services/newsCrawler.js';

export const adminRouter = express.Router();

/**
 * Health check & diagnostic status
 * GET /api/status
 */
adminRouter.get('/api/status', (req, res) => {
  try {
    const activeSubscribers = subscribersDb.countActive();
    const totalArticles = db.prepare(`SELECT COUNT(*) as count FROM raw_articles`).get().count;
    const totalEditions = db.prepare(`SELECT COUNT(*) as count FROM editions`).get().count;
    const latestEdition = editionsDb.getRecent(1)[0] || null;
    const recentLogs = db.prepare(`SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 10`).all();

    res.json({
      success: true,
      service: 'TechPulse AI',
      uptimeSeconds: process.uptime(),
      currentTime: new Date().toISOString(),
      timezone: 'Europe/Paris',
      metrics: {
        activeSubscribers,
        indexedArticles: totalArticles,
        editionsPublished: totalEditions
      },
      latestEdition,
      recentLogs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Trigger feed crawl manually
 * POST /api/admin/crawl
 */
adminRouter.post('/api/admin/crawl', async (req, res) => {
  try {
    const result = await crawlAllFeeds();
    res.json({ success: true, message: 'Crawl completed', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Trigger morning edition generation manually
 * POST /api/admin/generate-morning
 */
adminRouter.post('/api/admin/generate-morning', async (req, res) => {
  const send = req.body?.send === true;
  try {
    const result = await executeMorningCycle(send);
    res.json({ success: true, message: 'Morning edition generated', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Trigger afternoon edition generation manually
 * POST /api/admin/generate-afternoon
 */
adminRouter.post('/api/admin/generate-afternoon', async (req, res) => {
  const send = req.body?.send === true;
  try {
    const result = await executeAfternoonCycle(send);
    res.json({ success: true, message: 'Afternoon edition generated', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
