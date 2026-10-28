import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('ops/release-config.json', root), 'utf8'));
const blockers = [];
if (!/^1\.\d+\.\d+$/.test(String(config.releaseVersion || ''))) {
  blockers.push('Keine v1-Freigabeversion (B14/B15 dürfen nicht öffentlich ausgerollt werden)');
}
for (const field of ['publicReleaseApproved', 'privacyReviewed', 'imprintReviewed', 'firebaseStagingVerified',
  'appCheckVerified', 'costAlertsVerified', 'accountDataRemovalVerified', 'retentionPolicyReviewed']) {
  if (config[field] !== true) blockers.push(`${field}: Freigabe fehlt`);
}
if (!String(config.operatorName || '').trim()) blockers.push('Betreibername fehlt');
for (const field of ['operatorContactEmail', 'feedbackContactEmail']) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(config[field] || ''))) blockers.push(`${field}: Kontakt fehlt/ungültig`);
}
for (const page of ['datenschutz.html', 'impressum.html']) {
  const content = await readFile(new URL(page, root), 'utf8');
  if (/RELEASE_BLOCKER|NICHT zur öffentlichen Freigabe|noindex,nofollow/.test(content)) {
    blockers.push(`${page}: fachlich geprüfte Angaben fehlen`);
  }
}
if (blockers.length) {
  console.error(`Öffentliche Veröffentlichung GESPERRT:\n- ${blockers.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Freigabefelder vollständig: ${config.releaseVersion}. Unabhängige Kontrolle/Deployment-Freigabe bleibt erforderlich.`);
}
