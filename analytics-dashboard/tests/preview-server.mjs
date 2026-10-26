// Local-only portfolio preview: forwards analytics to the local test Worker.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
    let content = await readFile(file);
    if (file.endsWith('index.html')) content = Buffer.from(content.toString().replace('https://supanat-portfolio-analytics.phoomakmoosik.workers.dev', 'http://127.0.0.1:8787'));
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(404).end(); }
}).listen(8000, '127.0.0.1', () => console.log('Portfolio test preview: http://127.0.0.1:8000'));
