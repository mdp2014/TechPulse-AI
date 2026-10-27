import express from 'express';
import { editionsDb } from '../db/index.js';
import { renderEditionHtml } from '../services/emailRenderer.js';

export const editionsRouter = express.Router();

/**
 * List recent editions
 * GET /api/editions
 */
editionsRouter.get('/api/editions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const editions = editionsDb.getRecent(limit);
  res.json({ success: true, count: editions.length, editions });
});

/**
 * Get edition details by ID
 * GET /api/editions/:id
 */
editionsRouter.get('/api/editions/:id', (req, res) => {
  const edition = editionsDb.getById(req.params.id);
  if (!edition) {
    return res.status(404).json({ success: false, error: 'Édition introuvable' });
  }
  res.json({ success: true, edition });
});

/**
 * Serve full rendered HTML for an edition
 * GET /editions/:id
 */
editionsRouter.get('/editions/:id', (req, res) => {
  const edition = editionsDb.getById(req.params.id);
  if (!edition) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="fr"><head><meta charset="utf-8"><title>Édition introuvable</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Édition introuvable</h2>
        <p>L'édition demandée n'existe pas ou a été archivée.</p>
        <a href="/">Retour à l'accueil</a>
      </body></html>
    `);
  }

  // If HTML is already saved, serve it, otherwise render from JSON
  if (edition.parsedContent) {
    const html = renderEditionHtml(edition.parsedContent, edition.id);
    return res.send(html);
  }

  res.send(edition.html_content || 'Aucun contenu disponible.');
});
