import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { subscribersDb, verificationDb, editionsDb, db, logSystem } from '../db/index.js';
import { sendVerificationCodeEmail, sendEditionToSingleSubscriber } from '../services/emailSender.js';

export const subscriptionRouter = express.Router();

// Rate limiter: Max 10 subscription requests per minute per IP
const subscribeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Trop de requêtes. Veuillez patienter un instant.' },
  standardHeaders: true,
  legacyHeaders: false
});

const codeLimiter = subscribeLimiter;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generate6DigitCode() {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * ⚡ Ultra-Simple Direct Subscription (1 champ email + 1 clic -> envoi immédiat)
 * POST /api/subscribe
 */
subscriptionRouter.post('/subscribe', subscribeLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Veuillez saisir une adresse email valide.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Activer immédiatement l'abonné
    subscribersDb.confirmSubscriber(cleanEmail);
    const subscriber = db.prepare(`SELECT * FROM subscribers WHERE email = ?`).get(cleanEmail);

    // 2. Récupérer la dernière édition générée et l'envoyer sur le champ
    const latestEdition = editionsDb.getLatest();
    if (latestEdition && subscriber) {
      await sendEditionToSingleSubscriber(latestEdition.id, subscriber);
    }

    logSystem('info', 'subscription', `Direct instant subscription and email dispatch for ${cleanEmail}`);

    return res.json({
      success: true,
      message: "C'est envoyé ! Vous venez de recevoir votre première édition par email, et vous recevrez les prochaines chaque jour à 6h15 et 16h30."
    });
  } catch (err) {
    logSystem('error', 'subscription', `Direct subscription error for ${cleanEmail}: ${err.message}`);
    return res.status(500).json({ success: false, error: "Erreur lors de l'envoi. Veuillez réessayer." });
  }
});

subscriptionRouter.post('/subscribe/request-code', codeLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Adresse email invalide.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const subResult = subscribersDb.createOrUpdatePending(cleanEmail);
    if (subResult.alreadyActive) {
      return res.status(200).json({
        success: true,
        alreadyActive: true,
        message: 'Cette adresse email est déjà abonnée et active !'
      });
    }

    const code = generate6DigitCode();
    verificationDb.createCode(cleanEmail, code, 'subscribe', 15);

    // Send code email
    await sendVerificationCodeEmail(cleanEmail, code, 'subscribe');

    logSystem('info', 'subscription', `Sent subscription verification code to ${cleanEmail}`);
    return res.json({
      success: true,
      message: 'Un code de vérification à 6 chiffres vous a été envoyé par email.'
    });
  } catch (err) {
    logSystem('error', 'subscription', `Failed to request code for ${cleanEmail}: ${err.message}`);
    return res.status(500).json({ success: false, error: "Erreur lors de l'envoi du code." });
  }
});

/**
 * Verify code and confirm subscription
 * POST /api/subscribe/verify-code
 */
subscriptionRouter.post('/subscribe/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'Email et code requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = String(code).trim();

  try {
    const result = verificationDb.verifyCode(cleanEmail, cleanCode, 'subscribe');
    if (!result.success) {
      if (result.reason === 'CODE_EXPIRED') {
        return res.status(400).json({ success: false, error: 'Ce code a expiré. Veuillez en redemander un nouveau.' });
      }
      if (result.reason === 'MAX_ATTEMPTS_EXCEEDED') {
        return res.status(429).json({ success: false, error: 'Nombre maximal de tentatives dépassé. Veuillez redemander un code.' });
      }
      return res.status(400).json({
        success: false,
        error: `Code incorrect.${result.remainingAttempts ? ` ${result.remainingAttempts} tentative(s) restante(s).` : ''}`
      });
    }

    // Activate subscriber
    subscribersDb.confirmSubscriber(cleanEmail);
    logSystem('info', 'subscription', `Confirmed subscription for ${cleanEmail}`);

    return res.json({
      success: true,
      message: 'Votre abonnement à TechPulse AI est confirmé ! Vous recevrez la prochaine édition.'
    });
  } catch (err) {
    logSystem('error', 'subscription', `Verification error for ${cleanEmail}: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Erreur lors de la confirmation.' });
  }
});

/**
 * Request unsubscribe verification code
 * POST /api/unsubscribe/request-code
 */
subscriptionRouter.post('/unsubscribe/request-code', codeLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Adresse email invalide.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const code = generate6DigitCode();
    verificationDb.createCode(cleanEmail, code, 'unsubscribe', 15);
    await sendVerificationCodeEmail(cleanEmail, code, 'unsubscribe');

    logSystem('info', 'subscription', `Sent unsubscribe code to ${cleanEmail}`);
    return res.json({
      success: true,
      message: 'Un code de confirmation de désinscription vous a été envoyé.'
    });
  } catch (err) {
    logSystem('error', 'subscription', `Unsubscribe code error for ${cleanEmail}: ${err.message}`);
    return res.status(500).json({ success: false, error: "Erreur lors de l'envoi du code." });
  }
});

/**
 * Verify code and confirm unsubscribe
 * POST /api/unsubscribe/verify-code
 */
subscriptionRouter.post('/unsubscribe/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'Email et code requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = String(code).trim();

  try {
    const result = verificationDb.verifyCode(cleanEmail, cleanCode, 'unsubscribe');
    if (!result.success) {
      return res.status(400).json({ success: false, error: 'Code incorrect ou expiré.' });
    }

    subscribersDb.unsubscribeByEmail(cleanEmail);
    logSystem('info', 'subscription', `Unsubscribed ${cleanEmail} via code`);

    return res.json({
      success: true,
      message: 'Votre désinscription a été effectuée avec succès. Vous ne recevrez plus nos éditions.'
    });
  } catch (err) {
    logSystem('error', 'subscription', `Unsubscribe error: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Erreur lors de la désinscription.' });
  }
});

/**
 * One-Click Unsubscribe (RFC 8058 and Web Link)
 * GET & POST /api/unsubscribe/one-click
 */
const handleOneClickUnsub = async (req, res) => {
  const token = req.query.token || req.body?.token;
  if (!token) {
    return res.status(400).send('Jeton de désinscription manquant.');
  }

  try {
    const result = subscribersDb.unsubscribeByToken(token);
    if (!result.success) {
      return res.status(404).send('Lien de désinscription invalide ou expiré.');
    }

    logSystem('info', 'subscription', `Unsubscribed ${result.email} via one-click token`);

    if (req.method === 'POST') {
      return res.status(200).send('Unsubscribed successfully.');
    }
    // Redirect to web unsubscribe confirmation page
    return res.redirect('/unsubscribe.html?success=1');
  } catch (err) {
    logSystem('error', 'subscription', `One-click unsub error: ${err.message}`);
    return res.status(500).send('Erreur lors du traitement.');
  }
};

subscriptionRouter.get('/unsubscribe/one-click', handleOneClickUnsub);
subscriptionRouter.post('/unsubscribe/one-click', handleOneClickUnsub);
