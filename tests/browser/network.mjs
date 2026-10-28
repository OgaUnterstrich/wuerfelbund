import { readFileSync } from 'node:fs';

const allowedHosts = new Set(['127.0.0.1', 'localhost']);
const sdkVersion = '13.1.0';
const installedVersion = JSON.parse(readFileSync(new URL('../../node_modules/firebase/package.json', import.meta.url))).version;
if (installedVersion !== sdkVersion) throw new Error(`Browser-SDK-Version erwartet ${sdkVersion}, installiert ${installedVersion}`);
const sdkBundles = new Map(['app', 'auth', 'firestore', 'app-check'].map(name => [
  `/firebasejs/${sdkVersion}/firebase-${name}.js`,
  readFileSync(new URL(`../../node_modules/firebase/firebase-${name}.js`, import.meta.url)),
]));

/** Browser greift nur auf lokale Demo-Emulatoren zu; offizielle, versionierte
 * SDK-Bundles werden aus dem bereits installierten Firebase-NPM-Paket geliefert.
 * Keine externen CDN-/Firebase-Anfragen während der Browser-E2E-Prüfung. */
export async function isolateBrowserNetwork(context) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'www.gstatic.com' && url.protocol === 'https:') {
      const bundle = sdkBundles.get(url.pathname);
      return bundle ? route.fulfill({ status: 200, contentType: 'text/javascript',
        headers: { 'access-control-allow-origin': '*' }, body: bundle })
        : route.abort('blockedbyclient');
    }
    if (!allowedHosts.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
}
