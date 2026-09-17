const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { settingsDir } = require('./paths');

function trackerDir() {
  return path.join(settingsDir(), 'trackers');
}
const MAX_CAPTURE_CHARS = 12000;

function ensureTrackerDir() {
  fs.mkdirSync(trackerDir(), { recursive: true, mode: 0o700 });
}

function getLastCapturedSequence(sessionId) {
  ensureTrackerDir();
  const file = path.join(trackerDir(), `${sessionId}.txt`);
  if (!fs.existsSync(file)) return null;
  const value = Number(fs.readFileSync(file, 'utf-8').trim());
  return Number.isFinite(value) ? value : null;
}

function setLastCapturedSequence(sessionId, sequence) {
  ensureTrackerDir();
  fs.writeFileSync(path.join(trackerDir(), `${sessionId}.txt`), String(sequence));
}

function parseJsonl(file) {
  if (!file || !fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .map((line) => {
      if (!line.trim()) return null;
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function eventKind(record) {
  const payload = record?.payload;
  if (!payload || typeof payload !== 'object') return '';
  const event = payload.event;
  if (event && typeof event === 'object' && typeof event.kind === 'string') {
    return event.kind;
  }
  return typeof payload.kind === 'string' ? payload.kind : '';
}

function eventPayload(record) {
  const payload = record?.payload;
  if (!payload || typeof payload !== 'object') return {};
  return payload.event && typeof payload.event === 'object' ? payload.event : payload;
}

function cleanContent(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g, '')
    .replace(/<supermemory-recall>[\s\S]*?<\/supermemory-recall>/g, '')
    .replace(/<supermemory-status>[\s\S]*?<\/supermemory-status>/g, '')
    .trim();
}

function formatNewEntries(transcriptPath, sessionId) {
  const records = parseJsonl(transcriptPath);
  if (records.length === 0) return null;

  const lastSequence = getLastCapturedSequence(sessionId);
  const parts = [];
  let latestSequence = lastSequence;

  for (const record of records) {
    const sequence = Number(record.sequence);
    if (Number.isFinite(sequence)) {
      if (lastSequence !== null && sequence <= lastSequence) continue;
      latestSequence = sequence;
    }

    const kind = eventKind(record);
    const event = eventPayload(record);
    const payloadKind = record?.payload?.kind;

    if (kind === 'started' && payloadKind === 'run') {
      const prompt = cleanContent(event.prompt);
      if (prompt) parts.push(`<|start|>user<|message|>${prompt}<|end|>`);
      continue;
    }

    if (kind === 'assistant_message_committed') {
      const text = cleanContent(event.text);
      if (text) parts.push(`<|start|>assistant<|message|>${text}<|end|>`);
    }
  }

  if (parts.length === 0) return null;

  let formatted = parts.join('\n');
  if (formatted.length > MAX_CAPTURE_CHARS) {
    formatted = formatted.slice(-MAX_CAPTURE_CHARS);
  }

  return { formatted, lastSequence: latestSequence };
}

function resolveTranscriptPath(input) {
  if (typeof input.transcript_path === 'string' && input.transcript_path) {
    return input.transcript_path;
  }
  const sessionId = input.session_id;
  if (!sessionId) return null;
  const root = path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
    'muse',
    'sessions',
  );
  if (!fs.existsSync(root)) return null;
  try {
    const matches = [];
    const walk = (dir, depth) => {
      if (depth > 5) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === sessionId) {
            const log = path.join(next, 'session.jsonl');
            if (fs.existsSync(log)) matches.push(log);
          }
          walk(next, depth + 1);
        }
      }
    };
    walk(root, 0);
    return matches.sort().at(-1) || null;
  } catch {
    return null;
  }
}

module.exports = {
  formatNewEntries,
  setLastCapturedSequence,
  resolveTranscriptPath,
};
