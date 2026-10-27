import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationDb, subscribersDb, hashVerificationCode, db } from '../src/db/index.js';

test('Subscription & Verification Flow', async (t) => {
  const testEmail = `tester_${Date.now()}@testpulse.ai`;

  await t.test('1. Create verification code and verify hashed storage', () => {
    const code = '654321';
    verificationDb.createCode(testEmail, code, 'subscribe', 15);

    const row = db.prepare(`SELECT * FROM verification_codes WHERE email = ?`).get(testEmail);
    assert.ok(row, 'Verification code entry should exist');
    assert.notEqual(row.code_hash, code, 'Code must NOT be stored in clear text');
    assert.equal(row.code_hash, hashVerificationCode(testEmail, code), 'Code hash must match SHA-256');
    assert.equal(row.attempts, 0, 'Attempts count should be 0');
  });

  await t.test('2. Reject incorrect verification code and increment attempts', () => {
    const wrongResult = verificationDb.verifyCode(testEmail, '999999', 'subscribe');
    assert.equal(wrongResult.success, false);
    assert.equal(wrongResult.reason, 'INVALID_CODE');
    assert.equal(wrongResult.remainingAttempts, 4);

    const row = db.prepare(`SELECT * FROM verification_codes WHERE email = ?`).get(testEmail);
    assert.equal(row.attempts, 1, 'Attempts counter should be incremented');
  });

  await t.test('3. Accept valid code and activate subscriber', () => {
    const code = '654321';
    const validResult = verificationDb.verifyCode(testEmail, code, 'subscribe');
    assert.equal(validResult.success, true);

    // Code must be deleted after use to prevent replay
    const afterRow = db.prepare(`SELECT * FROM verification_codes WHERE email = ?`).get(testEmail);
    assert.equal(afterRow, undefined, 'Code should be deleted after successful verification');

    // Confirm subscriber
    const subResult = subscribersDb.confirmSubscriber(testEmail);
    assert.equal(subResult.success, true);

    const sub = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(testEmail);
    assert.equal(sub.status, 'active');
    assert.ok(sub.unsubscribe_token);
  });

  await t.test('4. Unsubscribe via one-click token', () => {
    const sub = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(testEmail);
    const unsubResult = subscribersDb.unsubscribeByToken(sub.unsubscribe_token);
    assert.equal(unsubResult.success, true);

    const updated = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(testEmail);
    assert.equal(updated.status, 'unsubscribed');
    assert.ok(updated.unsubscribed_at);
  });

  await t.test('5. Re-subscribe allows reactivation', () => {
    const reconfirm = subscribersDb.confirmSubscriber(testEmail);
    assert.equal(reconfirm.success, true);

    const reactivated = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(testEmail);
    assert.equal(reactivated.status, 'active');
    assert.equal(reactivated.unsubscribed_at, null);
  });
});
