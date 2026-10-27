#!/usr/bin/env node

/**
 * CLI script to manually generate and dispatch the Afternoon Edition (16:30)
 * Usage: node scripts/run_afternoon_edition.js [--no-send]
 */

import { executeAfternoonCycle } from '../src/services/scheduler.js';
import { editionsDb, deliveryLogsDb } from '../src/db/index.js';

const shouldSend = !process.argv.includes('--no-send');

console.log('=======================================================');
console.log('  TECHPULSE AI — EXÉCUTION ÉDITION APRÈS-MIDI (16H30)');
console.log(`  Envoi direct aux abonnés : ${shouldSend ? 'OUI' : 'NON (préparation uniquement)'}`);
console.log('=======================================================');

try {
  const result = await executeAfternoonCycle(shouldSend);
  const edition = editionsDb.getById(result.editionId);

  console.log('\n✅ Édition de l\'Après-Midi générée avec succès !');
  console.log('-------------------------------------------------------');
  console.log('ID :', edition.id);
  console.log('Date :', edition.edition_date);
  console.log('Titre :', edition.title);
  console.log('Nombre de sujets traités :', edition.stories_count);
  console.log('Statut :', edition.status);

  if (shouldSend) {
    const stats = deliveryLogsDb.getStatsForEdition(edition.id);
    console.log('Statistiques d\'envoi :', stats);
  }

  console.log(`\nConsulter le rendu complet dans votre navigateur :`);
  console.log(`http://localhost:3000/editions/${edition.id}`);
  process.exit(0);
} catch (err) {
  console.error('\n❌ Échec de la génération après-midi :', err);
  process.exit(1);
}
