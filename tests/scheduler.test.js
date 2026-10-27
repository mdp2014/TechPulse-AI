import test from 'node:test';
import assert from 'node:assert/strict';
import { Cron } from 'croner';
import { editionsDb, subscribersDb, deliveryLogsDb, db } from '../src/db/index.js';
import { sendEditionToSubscribers } from '../src/services/emailSender.js';

test('Scheduler & Idempotent Dispatch Tests', async (t) => {
  const testSubEmail = `idempotent_${Date.now()}@testpulse.ai`;
  subscribersDb.createOrUpdatePending(testSubEmail);
  subscribersDb.confirmSubscriber(testSubEmail);
  const subscriber = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(testSubEmail);

  const editionId = editionsDb.createEdition({
    type: 'morning',
    date: '2026-10-27',
    title: 'Test Idempotency Edition',
    summary: 'Summary for idempotency test',
    contentJson: {
      editionType: 'morning',
      editorialTitle: 'Test Idempotency',
      editorialDate: '27 Octobre 2026',
      editorialIntro: 'Intro',
      keyTakeaways: ['Point 1'],
      mustReadStories: [{
        title: 'Story 1',
        category: 'Tech',
        badge: 'Officiel',
        quickSummary: 'Summary',
        deepDive: 'Content',
        sources: [{ name: 'Test', url: 'https://test.com' }]
      }]
    },
    htmlContent: '<html><body>Test</body></html>',
    storiesCount: 1,
    status: 'ready'
  });

  await t.test('1. Croner correctly schedules with Europe/Paris timezone', () => {
    const job = new Cron('15 6 * * *', { timezone: 'Europe/Paris' });
    const nextRun = job.nextRun();
    assert.ok(nextRun instanceof Date);
    assert.ok(nextRun.getTime() > Date.now());
    job.stop();
  });

  await t.test('2. First dispatch succeeds and records in delivery_logs', async () => {
    const result = await sendEditionToSubscribers(editionId);
    assert.ok(result.sent >= 1, 'Should have sent to at least the test subscriber');

    const alreadySent = deliveryLogsDb.hasAlreadySent(editionId, subscriber.id);
    assert.equal(alreadySent, true, 'Delivery log must record that edition was sent to subscriber');
  });

  await t.test('3. Second dispatch is completely skipped (strict idempotency)', async () => {
    // Calling dispatch again on the same edition
    const secondResult = await sendEditionToSubscribers(editionId);
    assert.equal(secondResult.sent, 0, 'No new emails should be sent');
    assert.ok(secondResult.skipped >= 1, 'Subscriber should be skipped');
  });
});
