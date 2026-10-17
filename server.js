'use strict';

const http = require('node:http');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    return sendJson(res, 200, {
      service: 'StumbleZyx backend',
      status: 'online',
      apiReady: false,
      note: 'Backend game endpoints have not been implemented yet.'
    });
  }

  if (url.pathname === '/auth' || url.pathname === '/shared') {
    return sendJson(res, 501, {
      error: 'not_implemented',
      message: `The ${url.pathname} endpoint needs the StumbleZyx 0.56 API contract and server logic.`
    });
  }

  return sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, HOST, () => {
  console.log(`StumbleZyx backend scaffold listening on ${HOST}:${PORT}`);
});

server.on('error', (error) => {
  console.error('Backend failed to start:', error.message);
  process.exitCode = 1;
});
