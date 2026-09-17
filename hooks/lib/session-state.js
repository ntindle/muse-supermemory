const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { settingsDir } = require('./paths');

function stateRoot() {
  return path.join(settingsDir(), 'sessions');
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getSessionDir(sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) return null;
  return path.join(stateRoot(), hashValue(sessionId.trim()));
}

function ensurePrivateDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {}
}

function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  ensurePrivateDir(dir);
  const temporary = path.join(
    dir,
    `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, JSON.stringify(value), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    fs.renameSync(temporary, file);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch {}
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

module.exports = { getSessionDir, atomicWriteJson, readJson };
