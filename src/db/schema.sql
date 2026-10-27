-- TechPulse AI Database Schema

CREATE TABLE IF NOT EXISTS subscribers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'unsubscribed')),
    unsubscribe_token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    unsubscribed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_unsub_token ON subscribers(unsubscribe_token);

CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK(purpose IN ('subscribe', 'unsubscribe')),
    attempts INTEGER DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes(email);

CREATE TABLE IF NOT EXISTS raw_articles (
    id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    link TEXT UNIQUE NOT NULL,
    published_at DATETIME NOT NULL,
    summary TEXT,
    content TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raw_articles_pubdate ON raw_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_raw_articles_source ON raw_articles(source_name);

CREATE TABLE IF NOT EXISTS editions (
    id TEXT PRIMARY KEY,
    edition_type TEXT NOT NULL CHECK(edition_type IN ('morning', 'afternoon')),
    edition_date TEXT NOT NULL, -- Format YYYY-MM-DD
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content_json TEXT NOT NULL,
    html_content TEXT NOT NULL,
    stories_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('draft', 'ready', 'sending', 'sent', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_editions_date_type ON editions(edition_date, edition_type);

CREATE TABLE IF NOT EXISTS delivery_logs (
    id TEXT PRIMARY KEY,
    edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
    subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
    error_message TEXT,
    attempt_count INTEGER DEFAULT 1,
    sent_at DATETIME,
    UNIQUE(edition_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON delivery_logs(status);

CREATE TABLE IF NOT EXISTS system_logs (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error')),
    component TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
