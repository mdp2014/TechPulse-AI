import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEditionHtml } from '../src/services/emailRenderer.js';

test('Email Renderer Tests', async (t) => {
  const mockEditionData = {
    editionType: 'morning',
    editorialTitle: 'Grande avancée dans les puces quantiques',
    editorialDate: 'Mardi 27 Octobre 2026',
    editorialIntro: 'La course aux qubits franchit un cap historique cette nuit.',
    keyTakeaways: [
      'IBM dévoile un nouveau processeur à 10 000 qubits supraconducteurs',
      'Google Quantum AI annonce une fidélité de porte record'
    ],
    mustReadStories: [
      {
        id: 'story-1',
        title: 'Nouveau record quantique établi',
        category: 'Hardware & Sciences',
        badge: 'Officiel',
        hook: 'Une fidélité inédite atteinte en laboratoire.',
        quickSummary: 'Le processeur réussit des calculs hors de portée des supercalculateurs.',
        deepDive: 'Explications détaillées de la percée technologique réalisée...',
        contextAndImpact: 'Les algorithmes de cryptographie asymétrique devront accélérer leur transition post-quantique.',
        keyFacts: ['Fidélité: 99.9%', 'Échéance commerciale: 2028'],
        sources: [
          { name: 'IBM Newsroom', url: 'https://newsroom.ibm.com' }
        ],
        imageUrl: 'https://images.example.com/quantum.jpg'
      }
    ],
    thematicSections: [
      {
        category: 'Logiciels & Sécurité',
        items: [
          {
            title: 'Mise à jour critique d\'OpenSSH',
            summary: 'Un correctif comble une vulnérabilité théorique de dépassement de tampon.',
            sources: [{ name: 'BleepingComputer', url: 'https://bleepingcomputer.com' }]
          }
        ]
      }
    ],
    radarWatchlist: [
      {
        title: 'Keynote NVIDIA au Computex',
        expectedTimeline: 'Demain 10h',
        status: 'Confirmé',
        description: 'Annonce attendue des nouvelles architectures GPU.'
      }
    ]
  };

  const subscriber = {
    email: 'reader@example.com',
    unsubscribe_token: 'secret_unsub_token_777'
  };

  const html = renderEditionHtml(mockEditionData, 'edition-uuid-123', subscriber);

  await t.test('1. Generated HTML size is within email limits (< 95 KB)', () => {
    const byteSize = Buffer.byteLength(html, 'utf8');
    assert.ok(byteSize < 95 * 1024, `Size ${byteSize} bytes is below 95 KB limit to avoid Gmail clipping`);
  });

  await t.test('2. HTML does not contain forbidden JavaScript tags', () => {
    assert.equal(html.includes('<script'), false, 'Emails must not contain <script> tags');
  });

  await t.test('3. HTML contains personalized one-click unsubscribe token', () => {
    assert.ok(html.includes('secret_unsub_token_777'), 'Email must contain unique unsubscribe token');
  });

  await t.test('4. HTML contains key structural elements', () => {
    assert.ok(html.includes('Grande avancée dans les puces quantiques'));
    assert.ok(html.includes('ÉDITION DU MATIN • 06H15'));
    assert.ok(html.includes('IBM Newsroom'));
    assert.ok(html.includes('Nouveau record quantique'));
    assert.ok(html.includes('RADAR TECHPULSE'));
  });

  await t.test('5. Render afternoon edition contains updates block', () => {
    const afternoonData = {
      ...mockEditionData,
      editionType: 'afternoon',
      afternoonUpdates: [
        {
          originalStory: 'Annonce quantique',
          whatChanged: 'Le cours de bourse a réagi en hausse de 4%.',
          whyItMatters: 'Validation par les investisseurs.',
          sources: [{ name: 'TechCrunch', url: 'https://techcrunch.com' }]
        }
      ]
    };

    const afternoonHtml = renderEditionHtml(afternoonData, 'edition-pm-123', subscriber);
    assert.ok(afternoonHtml.includes('ÉDITION DE L’APRÈS-MIDI • 16H30'));
    assert.ok(afternoonHtml.includes('Ce qui a changé aujourd\'hui'));
    assert.ok(afternoonHtml.includes('Le cours de bourse a réagi en hausse de 4%'));
  });
});
