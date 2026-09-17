const fs = require('node:fs');
const path = require('node:path');
const { getGitRoot } = require('./git-utils');

const CONFIG_CANDIDATES = [
  path.join('.muse', 'supermemory.json'),
  path.join('.claude', '.supermemory-claude', 'config.json'),
];

function getConfigPath(cwd) {
  const gitRoot = getGitRoot(cwd);
  const basePath = gitRoot || cwd;
  for (const relative of CONFIG_CANDIDATES) {
    const candidate = path.join(basePath, relative);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(basePath, CONFIG_CANDIDATES[0]);
}

function loadProjectConfig(cwd) {
  try {
    const configPath = getConfigPath(cwd);
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveProjectConfig(cwd, config) {
  const gitRoot = getGitRoot(cwd);
  const basePath = gitRoot || cwd;
  const configPath = path.join(basePath, CONFIG_CANDIDATES[0]);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const existing = loadProjectConfig(cwd) || {};
  const data = { ...existing, ...config };
  fs.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`);
  return configPath;
}

module.exports = { getConfigPath, loadProjectConfig, saveProjectConfig };
