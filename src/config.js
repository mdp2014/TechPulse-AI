import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  appName: process.env.APP_NAME || 'TechPulse AI',
  appTagline: process.env.APP_TAGLINE || "Toute l'actualité technologique importante, expliquée par l'IA, directement dans votre boîte mail.",
  
  // Gemini AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    fallbackModel: 'gemini-3.5-flash-lite',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
  },

  // Database
  dbPath: path.resolve(rootDir, process.env.DB_PATH || './data/techpulse.db'),

  // Email
  email: {
    provider: process.env.EMAIL_PROVIDER || 'sandbox',
    from: process.env.EMAIL_FROM || 'TechPulse AI <newsletter@techpulse.ai>',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    resendApiKey: process.env.RESEND_API_KEY || ''
  },

  // Timezone & Scheduling
  timezone: process.env.TIMEZONE || 'Europe/Paris',
  schedules: {
    morningPrep: process.env.SCHEDULE_MORNING_PREP || '0 5 * * *',
    morningSend: process.env.SCHEDULE_MORNING_SEND || '15 6 * * *',
    afternoonPrep: process.env.SCHEDULE_AFTERNOON_PREP || '45 15 * * *',
    afternoonSend: process.env.SCHEDULE_AFTERNOON_SEND || '30 16 * * *'
  },

  rootDir
};
