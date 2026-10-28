import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const index = text('index.html');
const rules = text('firestore.rules');
const config = JSON.parse(text('ops/release-config.json'));

test('B16: Passwortwiederherstellung, Verifikation und sichere Kontoaktionen verdrahtet', () => {
  for (const id of ['cloud-password-reset', 'cloud-verify-send', 'cloud-verify-refresh',
    'cloud-account-export', 'cloud-account-delete', 'cloud-account-delete-password',
    'cloud-transfer-member', 'cloud-transfer-password', 'cloud-transfer-confirm']) {
    assert.match(index, new RegExp(`id="${id}"`), `UI fehlt: ${id}`);
  }
  for (const sdk of ['sendPasswordResetEmail', 'sendEmailVerification', 'reauthenticateWithCredential', 'deleteUser']) {
    assert.match(index, new RegExp(sdk));
  }
  assert.match(index, /accountArchive\(/);
  assert.match(index, /assertErasurePossible\(/);
  assert.match(index, /await deleteUser\(user\)/);
});

test('B16: Übergabe und Datenlöschung verwenden geprüfte Serverregeln', () => {
  assert.match(rules, /function validOwnerHandover\(campaignId\)/);
  assert.match(rules, /request\.auth\.token\.get\('email_verified', false\) == true/);
  assert.match(rules, /existsAfter\(memberPath\(campaignId, request\.auth\.uid\)\)/);
  assert.match(rules, /existsAfter\(userCampaignIndexPath\(campaignId, request\.auth\.uid\)\)/);
  assert.match(rules, /allow delete: if false; \/\/ Kein ungeprüftes rekursives Löschen/);
  assert.match(rules, /allow update: if false; \/\/ Rolle/);
  assert.match(index, /root\.data\(\)\.ownerId === user\.uid/);
});

test('B16: Spark-Freigabe, Rechtsangaben und App Check bleiben ohne Operator gesperrt', () => {
  assert.equal(config.releaseVersion, '1.0.0-rc.1');
  for (const key of ['publicReleaseApproved', 'privacyReviewed', 'imprintReviewed',
    'firebaseStagingVerified', 'appCheckVerified', 'costAlertsVerified',
    'accountDataRemovalVerified', 'retentionPolicyReviewed']) assert.equal(config[key], false);
  assert.match(text('js/rules/app-check-config.mjs'), /enterpriseAppCheckSiteKey = ''/);
  assert.match(index, /ReCaptchaEnterpriseProvider/);
  assert.match(text('datenschutz.html'), /RELEASE_BLOCKER/);
  assert.match(text('impressum.html'), /RELEASE_BLOCKER/);
});

test('B16: kein Push-Deploy, neuer Prüfblock in vorhandenen Workflows', () => {
  const verification = text('.github/workflows/verify.yml');
  const pages = text('.github/workflows/pages-release.yml');
  assert.match(verification, /test:b16:audit/);
  assert.match(pages, /workflow_dispatch/);
  assert.match(pages, /PUBLIC-V1-CONFIRMED/);
  assert.match(pages, /test:b16:audit/);
  assert.match(pages, /check:release/);
  assert.doesNotMatch(pages, /^\s*push:/m);
});

test('B16: kleine Bildschirme, Zoom-Grundlagen und reduzierte Bewegung bleiben erhalten', () => {
  assert.match(index, /name="viewport"/);
  assert.match(index, /cloud-account-settings/);
  assert.match(index, /aria-live="polite"/);
  assert.match(text('studio.css'), /prefers-reduced-motion/);
  assert.match(text('studio.css'), /focus-visible/);
  assert.match(text('docs/DESIGN_ANTI_AI_LOOK.md'), /KI/);
});

test('B16: Staging-/Produktivprojekt im RC nicht verbunden oder automatisch geschrieben', () => {
  const runtime = text('js/rules/firebase-runtime.mjs');
  assert.match(runtime, /projectId: 'wuerfelbund'/);
  assert.match(runtime, /projectId: 'demo-wuerfelbund'/);
  assert.doesNotMatch(runtime, /projectId: 'wuerfelbund-staging'/);
  assert.doesNotMatch(index, /initializeApp\(\s*\{[\s\S]*?serviceAccount/);
  assert.match(text('docs/B16_BETRIEB_RELEASE.md'), /wuerfelbund-staging/);
  assert.match(text('docs/B16_ROLLBACK.md'), /Rollback/);
});
