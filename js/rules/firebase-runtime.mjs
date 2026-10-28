/**
 * Einzige öffentliche Firebase-Konfiguration. Bei lokalem HTTP-Testbetrieb
 * werden AUSSCHLIESSLICH Emulatoren mit einer demo- Projekt-ID verwendet.
 * Demo-Projekte haben keine produktiven Cloud-Ressourcen.
 */
const liveConfig = Object.freeze({
  apiKey: 'AIzaSyB3Tlq5zaXXpE0rwG4C4si-BkAHIeplISk',
  authDomain: 'wuerfelbund.firebaseapp.com',
  projectId: 'wuerfelbund',
  storageBucket: 'wuerfelbund.firebasestorage.app',
  messagingSenderId: '308713612521',
  appId: '1:308713612521:web:ea9ab19e17263184dc7c78',
});

const localConfig = Object.freeze({
  apiKey: 'demo-key',
  authDomain: 'demo-wuerfelbund.firebaseapp.com',
  projectId: 'demo-wuerfelbund',
  appId: '1:123456789:web:demo-wuerfelbund',
});

export function firebaseRuntime(hostname, protocol = 'https:') {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      config: localConfig,
      emulator: { authUrl: 'http://127.0.0.1:9099', host: '127.0.0.1', firestorePort: 8080 },
    };
  }
  if (protocol !== 'https:') {
    throw new Error('Online-Zugang ist nur über HTTPS oder den lokalen Demo-Emulator zulässig.');
  }
  return { config: liveConfig, emulator: null };
}
