const fs = require('node:fs');
const { settingsDir, lastSessionFile } = require('./paths');

function saveLastSession({ id, containerTag }) {
  if (!id) return;
  fs.mkdirSync(settingsDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    lastSessionFile(),
    `${JSON.stringify(
      {
        id,
        containerTag: containerTag || null,
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
}

module.exports = { saveLastSession, lastSessionFile };
