import { config } from '../config.js';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getBadgeStyle(badge) {
  const b = (badge || '').toLowerCase();
  if (b.includes('officiel')) {
    return 'background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;';
  }
  if (b.includes('rumeur')) {
    return 'background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a;';
  }
  if (b.includes('mise à jour') || b.includes('alerte')) {
    return 'background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;';
  }
  return 'background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;';
}

/**
 * Render email HTML for morning or afternoon edition
 * @param {object} editionData JSON returned by Gemini
 * @param {string} editionId database ID of the edition
 * @param {object} subscriber optional subscriber object with { email, unsubscribe_token }
 */
export function renderEditionHtml(editionData, editionId, subscriber = null) {
  const isMorning = editionData.editionType === 'morning';
  const editionLabel = isMorning ? 'ÉDITION DU MATIN • 06H15' : 'ÉDITION DE L’APRÈS-MIDI • 16H30';
  const editionColor = isMorning ? '#2563eb' : '#d97706';
  const editionBgLight = isMorning ? '#eff6ff' : '#fffbeb';

  const webUrl = `${config.baseUrl}/editions/${editionId}`;
  const unsubUrl = subscriber?.unsubscribe_token 
    ? `${config.baseUrl}/unsubscribe?token=${subscriber.unsubscribe_token}`
    : `${config.baseUrl}/unsubscribe`;

  // Render Key Takeaways
  const takeawaysHtml = (editionData.keyTakeaways || []).map(item => `
    <tr>
      <td style="padding: 6px 0; vertical-align: top; width: 22px;">
        <span style="display: inline-block; width: 8px; height: 8px; background-color: ${editionColor}; border-radius: 50%; margin-top: 6px;"></span>
      </td>
      <td style="padding: 6px 0; font-size: 15px; line-height: 22px; color: #374151;">
        ${escapeHtml(item)}
      </td>
    </tr>
  `).join('');

  // Render Afternoon Updates (if afternoon edition)
  let afternoonUpdatesHtml = '';
  if (!isMorning && editionData.afternoonUpdates?.length) {
    const updateItems = editionData.afternoonUpdates.map(up => `
      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #b45309; margin-bottom: 4px;">
          MISE À JOUR DEPUIS CE MATIN
        </div>
        <div style="font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 6px;">
          ${escapeHtml(up.originalStory)}
        </div>
        <div style="font-size: 14px; line-height: 21px; color: #4b5563; margin-bottom: 8px;">
          <strong>Ce qui a changé :</strong> ${escapeHtml(up.whatChanged)}
        </div>
        <div style="font-size: 14px; line-height: 21px; color: #374151;">
          <strong>Pourquoi cela compte :</strong> ${escapeHtml(up.whyItMatters)}
        </div>
        ${up.sources?.length ? `
          <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
            Source(s) : ${up.sources.map(s => `<a href="${escapeHtml(s.url)}" target="_blank" style="color: #2563eb; text-decoration: none;">${escapeHtml(s.name)}</a>`).join(' • ')}
          </div>
        ` : ''}
      </div>
    `).join('');

    afternoonUpdatesHtml = `
      <div style="margin: 28px 0;">
        <div style="font-size: 18px; font-weight: 800; color: #111827; margin-bottom: 12px; border-bottom: 2px solid #f59e0b; padding-bottom: 6px;">
          ⚡ Ce qui a changé aujourd'hui
        </div>
        ${updateItems}
      </div>
    `;
  }

  // Render Must-Read Stories
  const mustReadHtml = (editionData.mustReadStories || []).map((story, idx) => {
    const badgeStyle = getBadgeStyle(story.badge);
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        ${story.imageUrl ? `
          <tr>
            <td>
              <img src="${escapeHtml(story.imageUrl)}" alt="${escapeHtml(story.title)}" width="100%" style="width: 100%; max-height: 300px; object-fit: cover; display: block; border-bottom: 1px solid #e5e7eb;" />
            </td>
          </tr>
        ` : ''}
        <tr>
          <td style="padding: 24px;">
            <div style="margin-bottom: 12px;">
              <span style="display: inline-block; padding: 3px 9px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px; ${badgeStyle} margin-right: 8px;">
                ${escapeHtml(story.badge || 'ACTUALITÉ')}
              </span>
              <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">
                ${escapeHtml(story.category || 'Technologie')}
              </span>
            </div>

            <h2 style="margin: 0 0 10px 0; font-size: 21px; font-weight: 800; line-height: 28px; color: #111827;">
              ${escapeHtml(story.title)}
            </h2>

            ${story.hook ? `
              <p style="margin: 0 0 14px 0; font-size: 15px; font-weight: 600; line-height: 22px; color: #4b5563;">
                ${escapeHtml(story.hook)}
              </p>
            ` : ''}

            <div style="background-color: #f9fafb; border-left: 3px solid ${editionColor}; border-radius: 4px; padding: 12px 14px; margin-bottom: 16px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #4b5563; margin-bottom: 4px;">
                L'essentiel en 30 secondes
              </div>
              <div style="font-size: 14px; line-height: 21px; color: #1f2937;">
                ${escapeHtml(story.quickSummary)}
              </div>
            </div>

            <div style="font-size: 15px; line-height: 24px; color: #374151; margin-bottom: 16px;">
              ${escapeHtml(story.deepDive).replace(/\n\n/g, '<br><br>')}
            </div>

            ${story.contextAndImpact ? `
              <div style="background-color: ${editionBgLight}; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 700; color: ${editionColor}; margin-bottom: 4px;">
                  💡 Pourquoi c'est important & Conséquences :
                </div>
                <div style="font-size: 14px; line-height: 21px; color: #1f2937;">
                  ${escapeHtml(story.contextAndImpact)}
                </div>
              </div>
            ` : ''}

            ${story.keyFacts?.length ? `
              <div style="margin-bottom: 16px; padding: 10px 14px; background-color: #f3f4f6; border-radius: 6px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 6px;">
                  Chiffres & Faits vérifiés
                </div>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #374151; line-height: 20px;">
                  ${story.keyFacts.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <div style="border-top: 1px solid #f3f4f6; padding-top: 12px; margin-top: 14px; font-size: 12px; color: #6b7280; display: flex; justify-content: space-between;">
              <div>
                <strong>Sources :</strong> 
                ${(story.sources || []).map(s => `<a href="${escapeHtml(s.url)}" target="_blank" style="color: #2563eb; text-decoration: underline; margin-right: 6px;">${escapeHtml(s.name)}</a>`).join(' ')}
              </div>
            </div>
          </td>
        </tr>
      </table>
    `;
  }).join('');

  // Render Thematic Sections
  let thematicHtml = '';
  if (editionData.thematicSections?.length) {
    thematicHtml = editionData.thematicSections.map(sec => `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px;">
          📁 ${escapeHtml(sec.category)}
        </div>
        ${sec.items.map(it => `
          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px;">
            <div style="font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px;">
              ${escapeHtml(it.title)}
            </div>
            <div style="font-size: 14px; line-height: 20px; color: #4b5563; margin-bottom: 6px;">
              ${escapeHtml(it.summary)}
            </div>
            ${it.sources?.length ? `
              <div style="font-size: 11px; color: #9ca3af;">
                Source : ${it.sources.map(s => `<a href="${escapeHtml(s.url)}" target="_blank" style="color: #6b7280; text-decoration: underline;">${escapeHtml(s.name)}</a>`).join(' ')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  // Render Radar Watchlist (if present)
  let radarHtml = '';
  if (editionData.radarWatchlist?.length) {
    radarHtml = `
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 8px; padding: 20px; margin: 28px 0; color: #ffffff;">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; margin-bottom: 8px;">
          🛰️ RADAR TECHPULSE • À SURVEILLER DANS LES PROCHAINES HEURES
        </div>
        ${editionData.radarWatchlist.map(r => `
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 15px; font-weight: 700; color: #ffffff;">${escapeHtml(r.title)}</span>
              <span style="font-size: 11px; background-color: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px;">${escapeHtml(r.status || 'À venir')}</span>
            </div>
            <div style="font-size: 13px; line-height: 19px; color: #cbd5e1; margin-bottom: 4px;">
              ${escapeHtml(r.description)}
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              Échéance estimée : ${escapeHtml(r.expectedTimeline || 'Prochainement')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(editionData.editorialTitle || config.appName)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #111827;
    }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; }
    a { color: #2563eb; }
    @media only screen and (max-width: 640px) {
      .container-table { width: 100% !important; padding: 12px !important; }
      .mobile-padding { padding: 16px !important; }
    }
    @media (prefers-color-scheme: dark) {
      body { background-color: #0b0f19 !important; color: #f9fafb !important; }
      .email-bg { background-color: #0b0f19 !important; }
      .card-bg { background-color: #111827 !important; border-color: #1f2937 !important; }
      .text-primary { color: #f9fafb !important; }
      .text-muted { color: #9ca3af !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <center style="width: 100%; background-color: #f3f4f6; padding: 20px 0;">
    <table role="presentation" class="container-table" width="640" cellpadding="0" cellspacing="0" style="max-width: 640px; width: 100%; margin: 0 auto;">
      
      <!-- Top Bar: View online -->
      <tr>
        <td style="padding: 0 0 12px 0; text-align: right; font-size: 11px; color: #6b7280;">
          <a href="${webUrl}" target="_blank" style="color: #6b7280; text-decoration: underline;">
            Ouvrir cette édition dans votre navigateur
          </a>
        </td>
      </tr>

      <!-- Newspaper Header -->
      <tr>
        <td style="background-color: #ffffff; border: 1px solid #e5e7eb; border-top: 4px solid ${editionColor}; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: ${editionColor}; margin-bottom: 6px;">
            ${editionLabel}
          </div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -0.5px; color: #111827; text-transform: uppercase;">
            ${escapeHtml(config.appName)}
          </h1>
          <div style="font-size: 13px; color: #6b7280; margin-top: 4px; font-style: italic;">
            ${escapeHtml(config.appTagline)}
          </div>
          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #f3f4f6; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: capitalize;">
            📅 ${escapeHtml(editionData.editorialDate)}
          </div>
        </td>
      </tr>

      <tr><td style="height: 16px;"></td></tr>

      <!-- Editorial Headline & Chapeau -->
      <tr>
        <td style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; line-height: 32px; color: #111827;">
            ${escapeHtml(editionData.editorialTitle)}
          </h2>
          <p style="margin: 0 0 18px 0; font-size: 16px; line-height: 25px; color: #4b5563;">
            ${escapeHtml(editionData.editorialIntro)}
          </p>

          <!-- Key takeaways box -->
          <div style="background-color: ${editionBgLight}; border: 1px solid ${isMorning ? '#bfdbfe' : '#fde68a'}; border-radius: 6px; padding: 16px 20px;">
            <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: ${editionColor}; margin-bottom: 10px;">
              ⏱️ CE QU'IL FAUT RETENIR (1 MINUTE DE LECTURE)
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${takeawaysHtml}
            </table>
          </div>
        </td>
      </tr>

      <tr><td style="height: 16px;"></td></tr>

      <!-- Afternoon updates (if afternoon edition) -->
      ${afternoonUpdatesHtml ? `<tr><td>${afternoonUpdatesHtml}</td></tr><tr><td style="height: 16px;"></td></tr>` : ''}

      <!-- Must-read section title -->
      <tr>
        <td style="padding: 10px 0 14px 4px;">
          <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #111827;">
            ⭐ Les Actualités Incontournables
          </div>
        </td>
      </tr>

      <!-- Must-Read Articles -->
      <tr>
        <td>
          ${mustReadHtml}
        </td>
      </tr>

      <!-- Thematic Sections -->
      ${thematicHtml ? `
        <tr><td style="height: 12px;"></td></tr>
        <tr><td>${thematicHtml}</td></tr>
      ` : ''}

      <!-- Radar Section -->
      ${radarHtml ? `
        <tr><td>${radarHtml}</td></tr>
      ` : ''}

      <!-- Footer with Unsubscribe -->
      <tr>
        <td style="padding: 24px 16px; text-align: center; font-size: 12px; line-height: 19px; color: #6b7280;">
          <p style="margin: 0 0 8px 0;">
            Vous recevez cet email car vous êtes abonné au journal <strong>${escapeHtml(config.appName)}</strong>.
          </p>
          <p style="margin: 0 0 14px 0;">
            Deux éditions quotidiennes : Matin à 6h15 • Après-midi à 16h30 (Heure de Paris).
          </p>
          <p style="margin: 0;">
            <a href="${unsubUrl}" style="color: #ef4444; font-weight: 600; text-decoration: underline;">
              Se désinscrire en un clic
            </a>
            &nbsp;•&nbsp;
            <a href="${config.baseUrl}/privacy" target="_blank" style="color: #6b7280; text-decoration: underline;">
              Politique de confidentialité (RGPD)
            </a>
            &nbsp;•&nbsp;
            <a href="${webUrl}" target="_blank" style="color: #6b7280; text-decoration: underline;">
              Version Web
            </a>
          </p>
          <p style="margin: 12px 0 0 0; font-size: 11px; color: #9ca3af;">
            Propulsé de manière 100% autonome par l'IA • © ${new Date().getFullYear()} ${escapeHtml(config.appName)}
          </p>
        </td>
      </tr>

    </table>
  </center>
</body>
</html>`;
}
