const { execFile } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  settingsDir,
  credentialsFile,
  claudeCredentialsFile,
} = require('./paths');

const authSuccessHtml = fs.readFileSync(
  path.join(__dirname, '../templates/auth-success.html'),
  'utf-8',
);
const authErrorHtml = fs.readFileSync(
  path.join(__dirname, '../templates/auth-error.html'),
  'utf-8',
);

const AUTH_BASE_URL =
  process.env.SUPERMEMORY_AUTH_URL || 'https://console.supermemory.ai/auth/connect';
const AUTH_PORT = 19877;
const AUTH_TIMEOUT = 25000;

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (err) => {
      err ? reject(err) : resolve();
    });
  });
}

async function openUrl(url) {
  const target = url.toString();
  if (!/^https?:\/\//i.test(target)) {
    throw new Error('Refusing to open non-http URL');
  }
  if (process.platform === 'win32') {
    try {
      await execFileAsync('rundll32.exe', [
        'url.dll,FileProtocolHandler',
        target,
      ]);
      return;
    } catch {}
    await execFileAsync('cmd.exe', ['/c', 'start', '""', target]);
    return;
  }
  if (process.platform === 'darwin') {
    await execFileAsync('open', [target]);
    return;
  }
  await execFileAsync('xdg-open', [target]);
}

function ensureDir() {
  fs.mkdirSync(settingsDir(), { recursive: true, mode: 0o700 });
}

function readCredentialFile(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return data?.apiKey ? data : null;
  } catch {
    return null;
  }
}

function loadCredentials() {
  return (
    readCredentialFile(credentialsFile()) ||
    readCredentialFile(claudeCredentialsFile())
  );
}

function saveCredentials(apiKey) {
  ensureDir();
  fs.writeFileSync(
    credentialsFile(),
    `${JSON.stringify({ apiKey, savedAt: new Date().toISOString() }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

function clearCredentials() {
  try {
    const file = credentialsFile();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}

function startAuthFlow() {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${AUTH_PORT}`);

      if (url.pathname === '/callback') {
        const apiKey =
          url.searchParams.get('apikey') || url.searchParams.get('api_key');

        if (apiKey?.startsWith('sm_')) {
          saveCredentials(apiKey);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(authSuccessHtml);
          resolved = true;
          server.close();
          resolve(apiKey);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(authErrorHtml);
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(AUTH_PORT, '127.0.0.1', () => {
      const callbackUrl = `http://localhost:${AUTH_PORT}/callback`;
      const authUrl = `${AUTH_BASE_URL}?callback=${encodeURIComponent(callbackUrl)}&client=muse_code`;
      openUrl(authUrl).catch((error) => {
        if (!resolved) {
          server.close();
          reject(new Error(`Failed to open browser: ${error.message}`));
        }
      });
    });

    server.on('error', (err) => {
      if (!resolved) {
        reject(new Error(`Failed to start auth server: ${err.message}`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        server.close();
        reject(new Error('AUTH_TIMEOUT'));
      }
    }, AUTH_TIMEOUT);
  });
}

module.exports = {
  AUTH_BASE_URL,
  credentialsFile,
  loadCredentials,
  saveCredentials,
  clearCredentials,
  startAuthFlow,
  openUrl,
};
