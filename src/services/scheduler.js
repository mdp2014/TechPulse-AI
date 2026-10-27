import { Cron } from 'croner';
import { config } from '../config.js';
import { editionsDb, logSystem } from '../db/index.js';
import { crawlAllFeeds, getArticlesForEdition } from './newsCrawler.js';
import { generateMorningEdition, generateAfternoonEdition } from './geminiEngine.js';
import { renderEditionHtml } from './emailRenderer.js';
import { sendEditionToSubscribers } from './emailSender.js';

let activeCronJobs = [];

/**
 * Execute the complete Morning cycle
 */
export async function executeMorningCycle(sendImmediately = false) {
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-'); // YYYY-MM-DD

  logSystem('info', 'scheduler', `[Morning Cycle] Starting preparation for ${todayStr} (sendImmediately=${sendImmediately})`);

  try {
    // 1. Crawl all feeds
    await crawlAllFeeds();

    // 2. Select overnight articles (last 16 hours)
    const windowStart = new Date(Date.now() - 16 * 3600 * 1000).toISOString();
    const articles = getArticlesForEdition(windowStart, null, 20);

    if (articles.length === 0) {
      logSystem('warn', 'scheduler', `[Morning Cycle] No articles found in window, expanding to 36 hours`);
      const fallbackStart = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
      articles.push(...getArticlesForEdition(fallbackStart, null, 15));
    }

    logSystem('info', 'scheduler', `[Morning Cycle] Curated ${articles.length} articles for AI synthesis`);

    // 3. AI Editorial Generation
    const frenchDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: config.timezone
    });
    const editionData = await generateMorningEdition(articles, frenchDate);

    // 4. Render HTML & Store Edition
    const totalStories = (editionData.mustReadStories?.length || 0) +
      (editionData.thematicSections?.reduce((acc, s) => acc + (s.items?.length || 0), 0) || 0);

    const initialHtml = renderEditionHtml(editionData, 'placeholder');
    const editionId = editionsDb.createEdition({
      type: 'morning',
      date: todayStr,
      title: editionData.editorialTitle || `TechPulse Matin — ${frenchDate}`,
      summary: editionData.editorialIntro || '',
      contentJson: editionData,
      htmlContent: initialHtml,
      storiesCount: totalStories,
      status: sendImmediately ? 'sending' : 'ready'
    });

    // Update with real ID in rendered HTML
    const finalHtml = renderEditionHtml(editionData, editionId);
    editionsDb.createEdition; // already created, html can be re-rendered on the fly

    logSystem('info', 'scheduler', `[Morning Cycle] Morning edition created with ID ${editionId} (status: ${sendImmediately ? 'sending' : 'ready'})`);

    // 5. Send if requested
    if (sendImmediately) {
      const stats = await sendEditionToSubscribers(editionId);
      logSystem('info', 'scheduler', `[Morning Cycle] Sent edition ${editionId}`, stats);
      return { editionId, stats };
    }

    return { editionId, status: 'ready' };
  } catch (err) {
    logSystem('error', 'scheduler', `[Morning Cycle] Critical failure: ${err.message}`, { stack: err.stack });
    throw err;
  }
}

/**
 * Execute the complete Afternoon cycle
 */
export async function executeAfternoonCycle(sendImmediately = false) {
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-');

  logSystem('info', 'scheduler', `[Afternoon Cycle] Starting preparation for ${todayStr} (sendImmediately=${sendImmediately})`);

  try {
    // 1. Crawl all feeds
    await crawlAllFeeds();

    // 2. Select daytime articles (since 06:00 today)
    const windowStart = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
    const articles = getArticlesForEdition(windowStart, null, 30);

    // 3. Retrieve morning edition for comparison
    const morningEdition = editionsDb.getLatest('morning');
    const morningSummary = morningEdition?.parsedContent ? {
      title: morningEdition.title,
      keyTakeaways: morningEdition.parsedContent.keyTakeaways,
      stories: morningEdition.parsedContent.mustReadStories?.map(s => s.title)
    } : null;

    // 4. AI Editorial Generation
    const frenchDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: config.timezone
    });
    const editionData = await generateAfternoonEdition(articles, morningSummary, frenchDate);

    // 5. Render HTML & Store Edition
    const totalStories = (editionData.mustReadStories?.length || 0) +
      (editionData.afternoonUpdates?.length || 0) +
      (editionData.thematicSections?.reduce((acc, s) => acc + (s.items?.length || 0), 0) || 0);

    const initialHtml = renderEditionHtml(editionData, 'placeholder');
    const editionId = editionsDb.createEdition({
      type: 'afternoon',
      date: todayStr,
      title: editionData.editorialTitle || `TechPulse Après-Midi — ${frenchDate}`,
      summary: editionData.editorialIntro || '',
      contentJson: editionData,
      htmlContent: initialHtml,
      storiesCount: totalStories,
      status: sendImmediately ? 'sending' : 'ready'
    });

    logSystem('info', 'scheduler', `[Afternoon Cycle] Afternoon edition created with ID ${editionId}`);

    // 6. Send if requested
    if (sendImmediately) {
      const stats = await sendEditionToSubscribers(editionId);
      logSystem('info', 'scheduler', `[Afternoon Cycle] Sent edition ${editionId}`, stats);
      return { editionId, stats };
    }

    return { editionId, status: 'ready' };
  } catch (err) {
    logSystem('error', 'scheduler', `[Afternoon Cycle] Critical failure: ${err.message}`, { stack: err.stack });
    throw err;
  }
}

/**
 * Dispatch morning edition (called at 06:15)
 */
async function dispatchMorningEdition() {
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-');

  logSystem('info', 'scheduler', `[06:15 Trigger] Dispatching morning edition for ${todayStr}`);

  // Look for ready edition
  const latest = editionsDb.getLatest('morning');
  if (latest && latest.edition_date === todayStr && latest.status === 'ready') {
    await sendEditionToSubscribers(latest.id);
  } else {
    logSystem('warn', 'scheduler', `[06:15 Trigger] No ready morning edition found for ${todayStr}. Running immediate recovery pipeline!`);
    await executeMorningCycle(true);
  }
}

/**
 * Dispatch afternoon edition (called at 16:30)
 */
async function dispatchAfternoonEdition() {
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-');

  logSystem('info', 'scheduler', `[16:30 Trigger] Dispatching afternoon edition for ${todayStr}`);

  const latest = editionsDb.getLatest('afternoon');
  if (latest && latest.edition_date === todayStr && latest.status === 'ready') {
    await sendEditionToSubscribers(latest.id);
  } else {
    logSystem('warn', 'scheduler', `[16:30 Trigger] No ready afternoon edition found for ${todayStr}. Running immediate recovery pipeline!`);
    await executeAfternoonCycle(true);
  }
}

/**
 * Start all scheduled jobs
 */
export function startScheduler() {
  stopScheduler(); // Clear any existing

  logSystem('info', 'scheduler', `Starting TechPulse scheduler in timezone: ${config.timezone}`);

  // 1. Morning Preparation (Default: 05:00)
  const morningPrepJob = new Cron(config.schedules.morningPrep, { timezone: config.timezone }, async () => {
    logSystem('info', 'scheduler', 'Triggering scheduled Morning Preparation (05:00)');
    try {
      await executeMorningCycle(false);
    } catch (e) {
      logSystem('error', 'scheduler', 'Scheduled Morning Preparation failed', { error: e.message });
    }
  });

  // 2. Morning Send (06:15)
  const morningSendJob = new Cron(config.schedules.morningSend, { timezone: config.timezone }, async () => {
    logSystem('info', 'scheduler', 'Triggering scheduled Morning Send (06:15)');
    try {
      await dispatchMorningEdition();
    } catch (e) {
      logSystem('error', 'scheduler', 'Scheduled Morning Send failed', { error: e.message });
    }
  });

  // 3. Afternoon Preparation (Default: 15:45)
  const afternoonPrepJob = new Cron(config.schedules.afternoonPrep, { timezone: config.timezone }, async () => {
    logSystem('info', 'scheduler', 'Triggering scheduled Afternoon Preparation (15:45)');
    try {
      await executeAfternoonCycle(false);
    } catch (e) {
      logSystem('error', 'scheduler', 'Scheduled Afternoon Preparation failed', { error: e.message });
    }
  });

  // 4. Afternoon Send (16:30)
  const afternoonSendJob = new Cron(config.schedules.afternoonSend, { timezone: config.timezone }, async () => {
    logSystem('info', 'scheduler', 'Triggering scheduled Afternoon Send (16:30)');
    try {
      await dispatchAfternoonEdition();
    } catch (e) {
      logSystem('error', 'scheduler', 'Scheduled Afternoon Send failed', { error: e.message });
    }
  });

  // 5. Periodic feed crawler every 2 hours (keeps DB warm)
  const periodicCrawlJob = new Cron('0 */2 * * *', { timezone: config.timezone }, async () => {
    logSystem('info', 'scheduler', 'Triggering periodic news crawl');
    try {
      await crawlAllFeeds();
    } catch (e) {
      logSystem('error', 'scheduler', 'Periodic crawl failed', { error: e.message });
    }
  });

  activeCronJobs = [morningPrepJob, morningSendJob, afternoonPrepJob, afternoonSendJob, periodicCrawlJob];

  logSystem('info', 'scheduler', `Registered ${activeCronJobs.length} automated server cron jobs (Europe/Paris)`);
}

export function stopScheduler() {
  for (const job of activeCronJobs) {
    job.stop();
  }
  activeCronJobs = [];
}
