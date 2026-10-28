const allowedHosts = new Set(['127.0.0.1', 'localhost', 'www.gstatic.com']);
const cdnCache = new Map();

async function readOfficialSdk(url) {
  if (!cdnCache.has(url)) {
    cdnCache.set(url, fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Firebase-CDN antwortet mit HTTP ${response.status}`);
      return { status: response.status,
        contentType: response.headers.get('content-type') || 'text/javascript',
        body: Buffer.from(await response.arrayBuffer()) };
    }));
  }
  try { return await cdnCache.get(url); }
  catch (error) { cdnCache.delete(url); throw error; }
}

/** Nur erlaubte Ressourcen; optionaler Relay für lokale Prüfnetze ohne Browser-CDN-Zugang. */
export async function isolateBrowserNetwork(context) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!allowedHosts.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
      return route.abort('blockedbyclient');
    }
    if (process.env.WUERFELBUND_TEST_CDN_RELAY === '1' && url.hostname === 'www.gstatic.com') {
      try {
        const sdk = await readOfficialSdk(url.href);
        return route.fulfill({ status: sdk.status, contentType: sdk.contentType,
          headers: { 'access-control-allow-origin': '*' }, body: sdk.body });
      } catch (error) {
        console.error(`Firebase-CDN nicht erreichbar: ${url.pathname}: ${error.message}`);
        return route.abort('failed');
      }
    }
    return route.continue();
  });
}
