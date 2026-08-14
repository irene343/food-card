const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = '/tmp/foodcard_data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');
const htmlTemplate = fs.readFileSync(HTML_PATH, 'utf-8');

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const qs = url.slice(idx + 1);
  const result = {};
  qs.split('&').forEach(pair => {
    const parts = pair.split('=');
    if (parts.length === 2) {
      result[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    }
  });
  return result;
}

function parsePath(url) {
  const idx = url.indexOf('?');
  return idx === -1 ? url : url.slice(0, idx);
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

const server = http.createServer((req, res) => {
  const urlPath = parsePath(req.url);
  const query = parseQuery(req.url);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Save
  if (urlPath === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const id = data.id || generateId();
        const fp = path.join(DATA_DIR, id + '.json');
        fs.writeFileSync(fp, JSON.stringify(data.profile), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: Load
  if (urlPath === '/api/load' && req.method === 'GET') {
    if (!query.id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Missing id' }));
      return;
    }
    const fp = path.join(DATA_DIR, query.id + '.json');
    if (!fs.existsSync(fp)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Not found' }));
      return;
    }
    try {
      const profile = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, profile }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // API: New ID
  if (urlPath === '/api/newid' && req.method === 'GET') {
    const id = generateId();
    const empty = { name: '', foods: { love: [], like: [], meh: [], nope: [] }, theme: 'hellokitty' };
    fs.writeFileSync(path.join(DATA_DIR, id + '.json'), JSON.stringify(empty), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id }));
    return;
  }

  // Serve HTML
  const mode = query.id ? 'view' : 'edit';
  const host = req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const serverUrl = proto + '://' + host;
  const html = htmlTemplate.replace(
    '</head>',
    `<script>window.__SERVER_URL__="${serverUrl}";window.__MODE__="${mode}";window.__SHARE_ID__="${query.id || ''}";</script></head>`
  );
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

const PORT = process.env.PORT || 3458;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});