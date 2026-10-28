import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedStagingTarget } from '../scripts/staging-target.mjs';

const environment = {WB_C3_PROJECT_ID: 'wuerfelbund-staging-a1',
  WB_C3_CONFIRM: 'STAGING:wuerfelbund-staging-a1'};

test('C3: nur eigenes, zweifach bestätigtes Staging-Projekt zulassen', () => {
  assert.equal(verifiedStagingTarget(environment), 'wuerfelbund-staging-a1');
  for (const id of ['', 'wuerfelbund', 'demo-wuerfelbund', 'anderes-projekt',
    'wuerfelbund-staging-a1/../wuerfelbund', 'staging', 'Wuerfelbund-Staging']) {
    assert.throws(() => verifiedStagingTarget({...environment, WB_C3_PROJECT_ID: id}), /C3 gesperrt/);
  }
});

test('C3: fehlende Bestätigung oder fremde Cloud- und Emulator-Umgebung stoppen', () => {
  for (const extra of [{WB_C3_CONFIRM: ''}, {WB_C3_CONFIRM: 'STAGING:wuerfelbund'},
    {GCLOUD_PROJECT: 'wuerfelbund'}, {GOOGLE_CLOUD_PROJECT: 'wuerfelbund'},
    {FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'},
    {FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'}]) {
    assert.throws(() => verifiedStagingTarget({...environment, ...extra}), /C3 gesperrt/);
  }
});
