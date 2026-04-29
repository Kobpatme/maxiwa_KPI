const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = 'D:/WebApp/SLA_Preformance/MAXIWA KPI/dist';
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4175');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.normalize(path.join(root, pathname));
    if (!filePath.startsWith(path.normalize(root))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    }[ext] || 'application/octet-stream';
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});
server.listen(4175, '127.0.0.1', () => console.log('MAXIWA local static server ready on http://127.0.0.1:4175'));
