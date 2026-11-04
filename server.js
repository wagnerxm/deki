/* Deki · servidor local simples (Node). Uso: node server.js  →  http://localhost:8787 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

/* busca um .ics de outra origem (Google/Outlook) para o app, que não consegue por causa do CORS */
function proxyIcs(url, res, hops) {
  hops = hops || 0;
  if (hops > 4) { res.writeHead(502); return res.end('muitos redirecionamentos'); }
  url = url.replace(/^webcal:\/\//i, 'https://');
  const mod = url.startsWith('https:') ? https : http;
  mod.get(url, { headers: { 'User-Agent': 'Deki/1.0' } }, r => {
    if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location) { r.resume(); return proxyIcs(new URL(r.headers.location, url).href, res, hops + 1); }
    if (r.statusCode !== 200) { res.writeHead(502); return res.end('a agenda respondeu ' + r.statusCode); }
    res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    r.pipe(res);
  }).on('error', e => { res.writeHead(502); res.end('não foi possível buscar: ' + e.message); });
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/ics' && u.searchParams.get('url')) return proxyIcs(u.searchParams.get('url'), res);
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`Deki rodando em  http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`No celular (mesma rede Wi-Fi):  http://${ip}:${PORT}`));
});
