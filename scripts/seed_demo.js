#!/usr/bin/env node

/**
 * Seed script to insert demo subscribers and initial setup
 */

import { subscribersDb, logSystem } from '../src/db/index.js';

console.log('--- SEEDING DEMO DATA ---');

const demoEmails = [
  'alexandre.tech@example.com',
  'sophie.developer@example.org',
  'julien.cto@example.net'
];

for (const email of demoEmails) {
  subscribersDb.createOrUpdatePending(email);
  subscribersDb.confirmSubscriber(email);
  console.log(`Confirmed demo subscriber: ${email}`);
}

console.log(`\nTotal active subscribers: ${subscribersDb.countActive()}`);
process.exit(0);
