const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const rootDir = __dirname;
const stateDir = process.env.STATE_DIR ? path.resolve(process.env.STATE_DIR) : path.join(rootDir, 'state');
const stateFile = path.join(stateDir, 'progress.json');
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4'
};

function normalizeViewed(input) {
  if (!Array.isArray(input)) return [];

  return Array.from(new Set(
    input
      .map(Number)
      .filter((index) => Number.isInteger(index) && index >= 0 && index < 10000)
  )).sort((a, b) => a - b);
}

function readProgress() {
  try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      viewed: normalizeViewed(parsed.viewed),
      updatedAt: parsed.updatedAt || null
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Could not read progress file:', error.message);
    }
    return { viewed: [], updatedAt: null };
  }
}

function writeProgress(viewed) {
  const progress = {
    viewed: normalizeViewed(viewed),
    updatedAt: new Date().toISOString()
  };

  fs.mkdirSync(stateDir, { recursive: true });
  const tempFile = stateFile + '.tmp';
  fs.writeFileSync(tempFile, JSON.stringify(progress, null, 2), 'utf8');
  fs.renameSync(tempFile, stateFile);

  return progress;
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function getStaticFilePath(urlPath) {
  let requestPath;

  try {
    requestPath = decodeURIComponent(urlPath);
  } catch (error) {
    return null;
  }

  if (requestPath === '/') requestPath = '/love_message.html';

  const safePath = path.normalize(requestPath).replace(/^[/\\]+/, '');
  const filePath = path.join(rootDir, safePath);
  const relativePath = path.relative(rootDir, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/progress') {
    sendJson(res, 200, readProgress());
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/progress/viewed') {
    try {
      const body = await readJsonBody(req);
      const index = Number(body.index);

      if (!Number.isInteger(index) || index < 0 || index >= 10000) {
        sendJson(res, 400, { error: 'Invalid star index' });
        return true;
      }

      const current = readProgress();
      const progress = writeProgress(current.viewed.concat(index));
      sendJson(res, 200, progress);
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/progress/sync') {
    try {
      const body = await readJsonBody(req);
      const current = readProgress();
      const progress = writeProgress(current.viewed.concat(normalizeViewed(body.viewed)));
      sendJson(res, 200, progress);
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
    }
    return true;
  }

  return false;
}

function serveStatic(req, res, pathname) {
  const filePath = getStaticFilePath(pathname);

  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, url.pathname);
    if (!handled) {
      sendJson(res, 404, { error: 'Not found' });
    }
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(port, () => {
  console.log(`Star message server is running at http://localhost:${port}`);
});
