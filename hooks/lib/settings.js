const fs = require('node:fs');
const { loadCredentials } = require('./auth');
const { loadProjectConfig } = require('./project-config');
const { settingsDir, settingsFile } = require('./paths');

const BASE_URL = 'https://api.supermemory.ai';

const DEFAULT_SETTINGS = {
  maxProfileItems: 5,
  debug: false,
  injectProfile: true,
  recallDirective: null,
};

function loadSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  const file = settingsFile();
  try {
    if (fs.existsSync(file)) {
      Object.assign(settings, JSON.parse(fs.readFileSync(file, 'utf-8')));
    }
  } catch (err) {
    console.error(`Settings: Failed to load ${file}: ${err.message}`);
  }
  if (process.env.SUPERMEMORY_DEBUG === 'true') settings.debug = true;
  return settings;
}

function envApiKey() {
  return (
    process.env.SUPERMEMORY_MUSE_API_KEY ||
    process.env.SUPERMEMORY_API_KEY ||
    process.env.SUPERMEMORY_CC_API_KEY ||
    null
  );
}

function getApiKey(cwd, projectConfig) {
  const fromEnv = envApiKey();
  if (fromEnv) return fromEnv;

  projectConfig = projectConfig || loadProjectConfig(cwd || process.cwd());
  if (projectConfig?.apiKey) return projectConfig.apiKey;

  const credentials = loadCredentials();
  if (credentials?.apiKey) return credentials.apiKey;

  throw new Error('NO_API_KEY');
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) return null;
  const trimmed = baseUrl.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

function getBaseUrl(cwd, projectConfig) {
  projectConfig = projectConfig || loadProjectConfig(cwd || process.cwd());
  const configured =
    process.env.SUPERMEMORY_API_URL || projectConfig?.baseUrl || BASE_URL;
  const normalized = normalizeBaseUrl(configured);
  if (!normalized) {
    throw new Error('Invalid baseUrl: expected an absolute http(s) URL');
  }
  return normalized;
}

function debugLog(settings, message, data) {
  if (!settings.debug) return;
  const timestamp = new Date().toISOString();
  console.error(
    data
      ? `[${timestamp}] ${message}: ${JSON.stringify(data)}`
      : `[${timestamp}] ${message}`,
  );
}

function getRecallConfig(cwd) {
  const settings = loadSettings();
  const projectConfig = loadProjectConfig(cwd || process.cwd());
  return {
    directive: projectConfig?.recallDirective || settings.recallDirective || null,
  };
}

module.exports = {
  settingsDir,
  settingsFile,
  DEFAULT_SETTINGS,
  loadSettings,
  getApiKey,
  getBaseUrl,
  debugLog,
  getRecallConfig,
};
