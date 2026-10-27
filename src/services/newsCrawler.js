import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { articlesDb, logSystem } from '../db/index.js';

// Registry of curated tech feeds
export const TECH_FEEDS = [
  // French Tech Media
  { name: 'Frandroid', url: 'https://www.frandroid.com/feed', category: 'Tech FR / Mobilité' },
  { name: 'Les Numériques', url: 'https://www.lesnumeriques.com/rss.xml', category: 'Tech FR / Matériel' },
  { name: 'Numerama', url: 'https://www.numerama.com/feed/', category: 'Tech FR / Société' },
  { name: '01net', url: 'https://www.01net.com/actualites/feed/', category: 'Tech FR / Actu' },

  // International Tech Media
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech Global' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'Startups & Tech' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Tech & Sciences' },
  { name: 'Wired Tech', url: 'https://www.wired.com/feed/category/gear/latest/rss', category: 'Innovations' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'Produits & Gadgets' },

  // Official Newsrooms & AI Labs
  { name: 'Apple Newsroom', url: 'https://www.apple.com/newsroom/rss-feed.rss', category: 'Officiel Apple' },
  { name: 'Google The Keyword', url: 'https://blog.google/rss/', category: 'Officiel Google' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', category: 'Officiel IA' },
  { name: 'Microsoft Stories', url: 'https://blogs.microsoft.com/feed/', category: 'Officiel Microsoft' },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/', category: 'Officiel NVIDIA / Hardware' },
  { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', category: 'Officiel OpenAI' },
  { name: 'Anthropic News', url: 'https://www.anthropic.com/news/feed', category: 'Officiel Anthropic' },
  { name: 'Meta Newsroom', url: 'https://about.fb.com/news/feed/', category: 'Officiel Meta' },

  // Cybersecurity & AI Research
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', category: 'Cybersécurité' },
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/', category: 'Cybersécurité' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', category: 'Intelligence Artificielle' }
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  textNodeName: '#text',
  trimValues: true
});

function sanitizeText(str) {
  if (!str) return '';
  if (typeof str === 'object') {
    if (str.__cdata) str = str.__cdata;
    else if (str['#text']) str = str['#text'];
    else str = JSON.stringify(str);
  }
  const clean = cheerio.load(String(str)).text();
  return clean.replace(/\s+/g, ' ').trim();
}

function extractImageUrl(item) {
  try {
    // 1. Enclosure
    if (item.enclosure && item.enclosure['@_url']) {
      const type = item.enclosure['@_type'] || '';
      if (type.startsWith('image/') || /\.(jpg|jpeg|png|webp|avif)/i.test(item.enclosure['@_url'])) {
        return item.enclosure['@_url'];
      }
    }
    // 2. Media content (media:content or media:thumbnail)
    const media = item['media:content'] || item['media:thumbnail'];
    if (media) {
      if (Array.isArray(media) && media[0]?.['@_url']) return media[0]['@_url'];
      if (media['@_url']) return media['@_url'];
    }
    // 3. Search <img> inside content:encoded or description
    const rawHtml = item['content:encoded'] || item.content || item.description || '';
    if (rawHtml) {
      const $ = cheerio.load(typeof rawHtml === 'object' ? (rawHtml.__cdata || '') : rawHtml);
      const src = $('img').first().attr('src');
      if (src && src.startsWith('http')) return src;
    }
  } catch (e) {
    // Ignore extraction failure
  }
  return null;
}

export async function fetchFeed(feed, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TechPulse/1.0 (+https://techpulse.ai)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const xmlText = await res.text();
    const parsed = xmlParser.parse(xmlText);

    // Support RSS 2.0 (<channel><item>) and Atom (<feed><entry>)
    let rawItems = [];
    if (parsed.rss && parsed.rss.channel && parsed.rss.channel.item) {
      rawItems = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item];
    } else if (parsed.feed && parsed.feed.entry) {
      rawItems = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
    }

    const normalizedArticles = [];

    for (const item of rawItems) {
      const title = sanitizeText(item.title);
      if (!title) continue;

      let link = '';
      if (typeof item.link === 'string') {
        link = item.link;
      } else if (item.link && item.link['@_href']) {
        link = item.link['@_href'];
      } else if (Array.isArray(item.link)) {
        const alt = item.link.find(l => l['@_rel'] === 'alternate') || item.link[0];
        link = alt?.['@_href'] || '';
      }

      if (!link) continue;

      // Extract pubDate / published / updated
      const rawDate = item.pubDate || item.published || item.updated || item['dc:date'];
      let publishedAt = new Date();
      if (rawDate) {
        const parsedDate = new Date(rawDate);
        if (!isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate;
        }
      }

      const summary = sanitizeText(item.description || item.summary || item['content:encoded'] || '').slice(0, 1000);
      const imageUrl = extractImageUrl(item);

      normalizedArticles.push({
        sourceName: feed.name,
        sourceUrl: feed.url,
        title,
        link,
        publishedAt: publishedAt.toISOString(),
        summary,
        imageUrl
      });
    }

    return { success: true, count: normalizedArticles.length, articles: normalizedArticles };
  } catch (err) {
    logSystem('warn', 'newsCrawler', `Feed fetch error for ${feed.name}: ${err.message}`);
    return { success: false, error: err.message, articles: [] };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Crawl all configured feeds in parallel and save new articles to SQLite
 */
export async function crawlAllFeeds() {
  logSystem('info', 'newsCrawler', `Starting crawl across ${TECH_FEEDS.length} tech sources`);
  const results = await Promise.allSettled(TECH_FEEDS.map(f => fetchFeed(f)));

  let totalSaved = 0;
  let successfulFeeds = 0;

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value.success) {
      successfulFeeds++;
      for (const art of res.value.articles) {
        const saved = articlesDb.saveArticle(art);
        if (saved) totalSaved++;
      }
    }
  }

  logSystem('info', 'newsCrawler', `Crawl finished. ${successfulFeeds}/${TECH_FEEDS.length} feeds OK, ${totalSaved} articles indexed/updated.`);
  return { successfulFeeds, totalFeeds: TECH_FEEDS.length, totalSaved };
}

/**
 * Retrieve curated articles for a given timeframe
 * @param {string} sinceIso ISO date string
 * @param {string} untilIso ISO date string (optional)
 * @param {number} maxArticles maximum articles to pass to AI
 */
export function getArticlesForEdition(sinceIso, untilIso = null, maxArticles = 50) {
  const articles = articlesDb.getArticlesInWindow(sinceIso, untilIso);

  // Group by domain to ensure diverse representation
  const bySource = {};
  for (const a of articles) {
    if (!bySource[a.source_name]) bySource[a.source_name] = [];
    bySource[a.source_name].push(a);
  }

  // Interleave sources so no single outlet dominates
  const balanced = [];
  const sourceKeys = Object.keys(bySource);
  let index = 0;
  let added = true;

  while (added && balanced.length < maxArticles) {
    added = false;
    for (const key of sourceKeys) {
      if (bySource[key][index]) {
        balanced.push(bySource[key][index]);
        added = true;
        if (balanced.length >= maxArticles) break;
      }
    }
    index++;
  }

  return balanced;
}
