/** Kleiner HTTP-Server ausschließlich für das generierte dist im Browsertest. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.WB_TEST_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Ungültiger WB_TEST_PORT');
}
const types = {
  '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript',
  '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  let path;
  try {
    const decoded = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    path = resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
    if (!path.startsWith(`${root}${sep}`)) throw new Error('Pfad außerhalb des Builds');
    if (!(await stat(path)).isFile()) throw new Error('Keine Datei');
    const body = await readFile(path);
    response.writeHead(200, {
      'Content-Type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Nicht gefunden');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Würfelbund Browser-Prüfserver: http://127.0.0.1:${port}/`);
});
