import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseRuntime } from '../js/rules/firebase-runtime.mjs';

test('Lokaler Testhost nutzt ausschließlich demo-ID und zwei Loopback-Emulatoren', () => {
  for (const hostname of ['127.0.0.1', 'localhost']) {
    const runtime = firebaseRuntime(hostname);
    assert.equal(runtime.config.projectId, 'demo-wuerfelbund');
    assert.match(runtime.config.projectId, /^demo-/);
    assert.equal(runtime.emulator.authUrl, 'http://127.0.0.1:9099');
    assert.equal(runtime.emulator.host, '127.0.0.1');
    assert.equal(runtime.emulator.firestorePort, 8080);
  }
});

test('GitHub-Pages-Domain bleibt auf dem bestehenden Produktionsprojekt', () => {
  const runtime = firebaseRuntime('ogaunterstrich.github.io');
  assert.equal(runtime.config.projectId, 'wuerfelbund');
  assert.equal(runtime.emulator, null);
});

test('Unsichere fremde Testhosts und lokale Datei öffnen keine Produktionsverbindung', () => {
  assert.throws(() => firebaseRuntime('192.168.1.10', 'http:'), /HTTPS/);
  assert.throws(() => firebaseRuntime('', 'file:'), /HTTPS/);
});
