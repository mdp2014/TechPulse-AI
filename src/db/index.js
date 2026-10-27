import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

// Ensure data directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);

// Enable WAL mode for high performance & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schemaPath = path.resolve(config.rootDir, 'src/db/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// System Logger Helper
export function logSystem(level, component, message, details = null) {
  try {
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO system_logs (id, level, component, message, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, level, component, message, details ? JSON.stringify(details) : null);
    if (level === 'error') {
      console.error(`[${component}] ERROR: ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${component}] WARN: ${message}`);
    } else {
      console.log(`[${component}] INFO: ${message}`);
    }
  } catch (err) {
    console.error('Failed to write system log:', err);
  }
}

// Verification Codes Operations
export function hashVerificationCode(email, code) {
  return crypto.createHash('sha256').update(`${email.toLowerCase()}:${code}:techpulse_salt_2026`).digest('hex');
}

export const verificationDb = {
  createCode(email, code, purpose = 'subscribe', validityMinutes = 15) {
    const id = crypto.randomUUID();
    const codeHash = hashVerificationCode(email, code);
    const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();

    // Invalidate previous pending codes for this email and purpose
    db.prepare(`DELETE FROM verification_codes WHERE email = ? AND purpose = ?`).run(email.toLowerCase(), purpose);

    const stmt = db.prepare(`
      INSERT INTO verification_codes (id, email, code_hash, purpose, attempts, expires_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `);
    stmt.run(id, email.toLowerCase(), codeHash, purpose, expiresAt);
    return { id, expiresAt };
  },

  verifyCode(email, code, purpose = 'subscribe') {
    const codeHash = hashVerificationCode(email, code);
    const row = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE email = ? AND purpose = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(email.toLowerCase(), purpose);

    if (!row) {
      return { success: false, reason: 'CODE_NOT_FOUND' };
    }

    if (new Date(row.expires_at) < new Date()) {
      return { success: false, reason: 'CODE_EXPIRED' };
    }

    if (row.attempts >= 5) {
      return { success: false, reason: 'MAX_ATTEMPTS_EXCEEDED' };
    }

    if (row.code_hash !== codeHash) {
      db.prepare(`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
      const remaining = 5 - (row.attempts + 1);
      return { success: false, reason: 'INVALID_CODE', remainingAttempts: remaining };
    }

    // Code is valid: delete it to prevent reuse
    db.prepare(`DELETE FROM verification_codes WHERE id = ?`).run(row.id);
    return { success: true };
  }
};

// Subscribers Operations
export const subscribersDb = {
  createOrUpdatePending(email) {
    const cleanEmail = email.toLowerCase().trim();
    const existing = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(cleanEmail);
    const unsubToken = crypto.randomBytes(24).toString('hex');

    if (existing) {
      if (existing.status === 'active') {
        return { isNew: false, alreadyActive: true, subscriber: existing };
      }
      return { isNew: false, alreadyActive: false, subscriber: existing };
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO subscribers (id, email, status, unsubscribe_token)
      VALUES (?, ?, 'pending', ?)
    `).run(id, cleanEmail, unsubToken);

    return { isNew: true, alreadyActive: false, subscriber: { id, email: cleanEmail, status: 'pending', unsubscribe_token: unsubToken } };
  },

  confirmSubscriber(email) {
    const cleanEmail = email.toLowerCase().trim();
    const existing = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(cleanEmail);
    const now = new Date().toISOString();

    if (!existing) {
      const id = crypto.randomUUID();
      const unsubToken = crypto.randomBytes(24).toString('hex');
      db.prepare(`
        INSERT INTO subscribers (id, email, status, unsubscribe_token, confirmed_at)
        VALUES (?, ?, 'active', ?, ?)
      `).run(id, cleanEmail, unsubToken, now);
      return { success: true, subscriberId: id };
    }

    db.prepare(`
      UPDATE subscribers 
      SET status = 'active', confirmed_at = ?, unsubscribed_at = NULL 
      WHERE email = ?
    `).run(now, cleanEmail);

    return { success: true, subscriberId: existing.id };
  },

  unsubscribeByToken(token) {
    const subscriber = db.prepare(`SELECT * FROM subscribers WHERE unsubscribe_token = ?`).get(token);
    if (!subscriber) return { success: false, reason: 'TOKEN_NOT_FOUND' };

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE subscribers 
      SET status = 'unsubscribed', unsubscribed_at = ? 
      WHERE id = ?
    `).run(now, subscriber.id);

    return { success: true, email: subscriber.email };
  },

  unsubscribeByEmail(email) {
    const cleanEmail = email.toLowerCase().trim();
    const subscriber = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(cleanEmail);
    if (!subscriber) return { success: false, reason: 'NOT_FOUND' };

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE subscribers 
      SET status = 'unsubscribed', unsubscribed_at = ? 
      WHERE id = ?
    `).run(now, subscriber.id);

    return { success: true, email: cleanEmail };
  },

  getActiveSubscribers() {
    return db.prepare(`SELECT id, email, unsubscribe_token FROM subscribers WHERE status = 'active'`).all();
  },

  countActive() {
    return db.prepare(`SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'`).get().count;
  }
};

// Raw Articles Operations
export const articlesDb = {
  saveArticle({ sourceName, sourceUrl, title, link, publishedAt, summary, content, imageUrl }) {
    try {
      const id = crypto.randomUUID();
      const stmt = db.prepare(`
        INSERT INTO raw_articles (id, source_name, source_url, title, link, published_at, summary, content, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(link) DO UPDATE SET
          title = excluded.title,
          summary = excluded.summary,
          content = excluded.content,
          image_url = coalesce(excluded.image_url, raw_articles.image_url)
      `);
      stmt.run(id, sourceName, sourceUrl, title, link, publishedAt, summary || null, content || null, imageUrl || null);
      return true;
    } catch (err) {
      logSystem('error', 'articlesDb', `Failed to save article ${title}`, { error: err.message });
      return false;
    }
  },

  getArticlesInWindow(sinceIso, untilIso = null) {
    let query = `SELECT * FROM raw_articles WHERE published_at >= ?`;
    const params = [sinceIso];
    if (untilIso) {
      query += ` AND published_at <= ?`;
      params.push(untilIso);
    }
    query += ` ORDER BY published_at DESC`;
    return db.prepare(query).all(...params);
  }
};

// Editions Operations
export const editionsDb = {
  createEdition({ type, date, title, summary, contentJson, htmlContent, storiesCount, status = 'ready' }) {
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO editions (id, edition_type, edition_date, title, summary, content_json, html_content, stories_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, type, date, title, summary, JSON.stringify(contentJson), htmlContent, storiesCount, status);
    return id;
  },

  getById(id) {
    const row = db.prepare(`SELECT * FROM editions WHERE id = ?`).get(id);
    if (row && row.content_json) {
      try {
        row.parsedContent = JSON.parse(row.content_json);
      } catch (e) {
        row.parsedContent = null;
      }
    }
    return row;
  },

  getLatest(type = null) {
    let query = `SELECT * FROM editions`;
    const params = [];
    if (type) {
      query += ` WHERE edition_type = ?`;
      params.push(type);
    }
    query += ` ORDER BY created_at DESC LIMIT 1`;
    const row = db.prepare(query).get(...params);
    if (row && row.content_json) {
      try {
        row.parsedContent = JSON.parse(row.content_json);
      } catch (e) {
        row.parsedContent = null;
      }
    }
    return row;
  },

  getRecent(limit = 10) {
    return db.prepare(`
      SELECT id, edition_type, edition_date, title, summary, stories_count, status, created_at, sent_at
      FROM editions ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  },

  updateStatus(id, status, sentAt = null) {
    if (sentAt) {
      db.prepare(`UPDATE editions SET status = ?, sent_at = ? WHERE id = ?`).run(status, sentAt, id);
    } else {
      db.prepare(`UPDATE editions SET status = ? WHERE id = ?`).run(status, id);
    }
  }
};

// Delivery Logs Operations
export const deliveryLogsDb = {
  hasAlreadySent(editionId, subscriberId) {
    const row = db.prepare(`
      SELECT status FROM delivery_logs 
      WHERE edition_id = ? AND subscriber_id = ? AND status IN ('sent', 'delivered')
    `).get(editionId, subscriberId);
    return !!row;
  },

  recordAttempt({ editionId, subscriberId, status, errorMessage = null }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO delivery_logs (id, edition_id, subscriber_id, status, error_message, sent_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(edition_id, subscriber_id) DO UPDATE SET
        status = excluded.status,
        error_message = excluded.error_message,
        attempt_count = delivery_logs.attempt_count + 1,
        sent_at = excluded.sent_at
    `);
    stmt.run(id, editionId, subscriberId, status, errorMessage, now);
  },

  getStatsForEdition(editionId) {
    return db.prepare(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM delivery_logs 
      WHERE edition_id = ? 
      GROUP BY status
    `).all(editionId);
  }
};
