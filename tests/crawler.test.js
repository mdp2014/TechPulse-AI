import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFeed, TECH_FEEDS, getArticlesForEdition } from '../src/services/newsCrawler.js';

test('News Crawler & Feed Ingestion', async (t) => {

  await t.test('1. Verified feeds registry contains required sources', () => {
    assert.ok(TECH_FEEDS.length >= 15, 'Must contain at least 15 curated tech feeds');
    const names = TECH_FEEDS.map(f => f.name.toLowerCase());
    assert.ok(names.includes('the verge'));
    assert.ok(names.includes('techcrunch'));
    assert.ok(names.includes('frandroid'));
    assert.ok(names.includes('numerama'));
    assert.ok(names.includes('apple newsroom'));
    assert.ok(names.includes('google the keyword'));
  });

  await t.test('2. Successfully fetch and parse The Verge RSS feed', async () => {
    const vergeFeed = TECH_FEEDS.find(f => f.name === 'The Verge');
    const result = await fetchFeed(vergeFeed, 8000);
    assert.equal(result.success, true);
    assert.ok(result.articles.length > 0);

    const first = result.articles[0];
    assert.ok(first.title, 'Article must have a title');
    assert.ok(first.link.startsWith('http'), 'Article must have a valid URL link');
    assert.ok(first.publishedAt, 'Article must have a publication date');
  });

  await t.test('3. Balanced article windowing', () => {
    const windowStart = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const articles = getArticlesForEdition(windowStart, null, 15);
    assert.ok(Array.isArray(articles));
  });
});
