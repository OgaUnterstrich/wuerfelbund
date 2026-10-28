import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appCheckEnabled, enterpriseAppCheckSiteKey } from '../js/rules/app-check-config.mjs';

test('B16-R2: App Check bleibt ohne freigegebenen Site-Key aus', () => {
  assert.equal(enterpriseAppCheckSiteKey, '');
  assert.equal(appCheckEnabled({ emulator: null, protocol: 'https:' }), false);
});

test('B16-R2: ein späterer Site-Key wirkt nur bei HTTPS und niemals im Emulator', () => {
  assert.equal(appCheckEnabled({ emulator: null, protocol: 'https:' }, 'public-site-key'), true);
  assert.equal(appCheckEnabled({ emulator: { authUrl: 'http://127.0.0.1:9099' }, protocol: 'http:' }, 'public-site-key'), false);
  assert.equal(appCheckEnabled({ emulator: null, protocol: 'http:' }, 'public-site-key'), false);
});
