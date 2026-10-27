import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { db, subscribersDb, editionsDb, deliveryLogsDb, logSystem } from '../db/index.js';
import { renderEditionHtml } from './emailRenderer.js';

// Ensure sandbox directory exists
const sandboxDir = path.resolve(config.rootDir, 'data/sandbox_emails');
if (!fs.existsSync(sandboxDir)) {
  fs.mkdirSync(sandboxDir, { recursive: true });
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (config.email.provider === 'smtp' && config.email.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass
      }
    });
    logSystem('info', 'emailSender', `Configured SMTP transporter on ${config.email.smtp.host}:${config.email.smtp.port}`);
  } else {
    // Sandbox / Test transporter
    transporter = {
      async sendMail(mailOptions) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const filePath = path.join(sandboxDir, `${id}.html`);
        const metaPath = path.join(sandboxDir, `${id}.json`);

        fs.writeFileSync(filePath, mailOptions.html || mailOptions.text || '', 'utf8');
        fs.writeFileSync(metaPath, JSON.stringify({
          to: mailOptions.to,
          from: mailOptions.from,
          subject: mailOptions.subject,
          headers: mailOptions.headers,
          date: new Date().toISOString()
        }, null, 2), 'utf8');

        logSystem('info', 'emailSender', `[SANDBOX] Email recorded to ${mailOptions.to} (Subject: ${mailOptions.subject}). Preview: file://${filePath}`);
        return { messageId: `sandbox-${id}`, simulated: true };
      }
    };
    logSystem('info', 'emailSender', `Running in SANDBOX mode (emails stored locally in data/sandbox_emails/)`);
  }

  return transporter;
}

/**
 * Send 6-digit verification code email
 */
export async function sendVerificationCodeEmail(toEmail, code, purpose = 'subscribe') {
  const mailer = getTransporter();
  const isSub = purpose === 'subscribe';
  const subject = isSub 
    ? `Votre code de confirmation ${config.appName} : ${code}`
    : `Confirmation de désinscription ${config.appName} : ${code}`;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>${subject}</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 24px; color: #111827;">
      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 8px;">
          ${config.appName}
        </div>
        <p style="font-size: 15px; line-height: 22px; color: #4b5563; margin-bottom: 24px;">
          ${isSub 
            ? 'Pour confirmer votre abonnement aux deux éditions quotidiennes (6h15 et 16h30), veuillez saisir le code de vérification suivant :' 
            : 'Pour valider votre demande de désinscription, veuillez saisir le code suivant :'}
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #bfdbfe;">
            ${code}
          </span>
        </div>

        <p style="font-size: 13px; line-height: 20px; color: #6b7280; margin-bottom: 24px;">
          ⏱️ Ce code expire dans <strong>15 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
        </p>

        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 20px 0;">
        <div style="font-size: 11px; color: #9ca3af; text-align: center;">
          ${config.appName} • Le journal technologique 100% autonome
        </div>
      </div>
    </body>
    </html>
  `;

  return mailer.sendMail({
    from: config.email.from,
    to: toEmail,
    subject,
    html
  });
}

/**
 * Dispatch an edition to all active subscribers
 */
export async function sendEditionToSubscribers(editionId) {
  const edition = editionsDb.getById(editionId);
  if (!edition) {
    throw new Error(`Edition ${editionId} not found`);
  }

  const subscribers = subscribersDb.getActiveSubscribers();
  if (subscribers.length === 0) {
    logSystem('info', 'emailSender', `No active subscribers to send edition ${editionId}`);
    editionsDb.updateStatus(editionId, 'sent', new Date().toISOString());
    return { sent: 0, skipped: 0, failed: 0 };
  }

  logSystem('info', 'emailSender', `Starting dispatch of edition ${editionId} ("${edition.title}") to ${subscribers.length} subscribers`);
  editionsDb.updateStatus(editionId, 'sending');

  const mailer = getTransporter();
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const sub of subscribers) {
    // 1. Strict Idempotency check
    if (deliveryLogsDb.hasAlreadySent(editionId, sub.id)) {
      skippedCount++;
      continue;
    }

    // 2. Personalize HTML with unique unsubscribe token
    const personalizedHtml = renderEditionHtml(edition.parsedContent, edition.id, sub);
    const oneClickUnsubUrl = `${config.baseUrl}/api/unsubscribe/one-click?token=${sub.unsubscribe_token}`;

    const mailOptions = {
      from: config.email.from,
      to: sub.email,
      subject: `[${config.appName}] ${edition.title}`,
      html: personalizedHtml,
      headers: {
        'List-Unsubscribe': `<${oneClickUnsubUrl}>, <mailto:unsubscribe@${new URL(config.baseUrl).hostname || 'techpulse.ai'}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': `edition-${editionId}-${sub.id}`
      }
    };

    let attempt = 0;
    let delivered = false;
    let lastError = null;

    // Retry loop up to 3 attempts with exponential backoff
    while (attempt < 3 && !delivered) {
      attempt++;
      try {
        await mailer.sendMail(mailOptions);
        delivered = true;
        deliveryLogsDb.recordAttempt({
          editionId,
          subscriberId: sub.id,
          status: 'sent'
        });
        sentCount++;
      } catch (err) {
        lastError = err.message;
        logSystem('warn', 'emailSender', `Attempt ${attempt}/3 failed for ${sub.email}: ${err.message}`);
        if (attempt < 3) {
          // Wait 500ms * 2^attempt
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        }
      }
    }

    if (!delivered) {
      failedCount++;
      deliveryLogsDb.recordAttempt({
        editionId,
        subscriberId: sub.id,
        status: 'failed',
        errorMessage: lastError
      });
      logSystem('error', 'emailSender', `Permanent dispatch failure for subscriber ${sub.email}`, { error: lastError });
    }
  }

  editionsDb.updateStatus(editionId, 'sent', new Date().toISOString());
  return { sent: sentCount, skipped: skippedCount, failed: failedCount };
}

/**
 * Send latest edition immediately to a single new subscriber
 */
export async function sendEditionToSingleSubscriber(editionId, subscriber) {
  const edition = editionsDb.getById(editionId);
  if (!edition) return false;

  const mailer = getTransporter();
  const personalizedHtml = renderEditionHtml(edition.parsedContent, edition.id, subscriber);
  const oneClickUnsubUrl = `${config.baseUrl}/api/unsubscribe/one-click?token=${subscriber.unsubscribe_token}`;

  const mailOptions = {
    from: config.email.from,
    to: subscriber.email,
    subject: `[${config.appName}] Bienvenue ! ${edition.title}`,
    html: personalizedHtml,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubUrl}>, <mailto:unsubscribe@${new URL(config.baseUrl).hostname || 'techpulse.ai'}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID': `welcome-${editionId}-${subscriber.id}`
    }
  };

  try {
    await mailer.sendMail(mailOptions);
    deliveryLogsDb.recordAttempt({
      editionId,
      subscriberId: subscriber.id,
      status: 'sent'
    });
    logSystem('info', 'emailSender', `Instant welcome edition sent to ${subscriber.email}`);
    return true;
  } catch (err) {
    logSystem('error', 'emailSender', `Failed sending instant edition to ${subscriber.email}: ${err.message}`);
    return false;
  }
}

