import 'dotenv/config';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number`);
  }
  return parsed;
}

function booleanEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;

  const value = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(value)) return true;
  if (['false', '0', 'no', 'n'].includes(value)) return false;

  throw new Error(`Environment variable ${name} must be a boolean value`);
}

export const config = {
  discordToken: requireEnv('DISCORD_TOKEN'),
  newsChannelId: requireEnv('NEWS_CHANNEL_ID'),
  adminLogChannelId: requireEnv('ADMIN_LOG_CHANNEL_ID'),
  adminRoleId: requireEnv('ADMIN_ROLE_ID'),
  mentionMode: process.env.MENTION_MODE?.trim() || 'everyone',
  newsRoleId: process.env.NEWS_ROLE_ID?.trim() || '',
  pollIntervalMinutes: numberEnv('POLL_INTERVAL_MINUTES', 60),
  adminAlertCooldownMinutes: numberEnv('ADMIN_ALERT_COOLDOWN_MINUTES', 360),
  maxNewsPerSource: numberEnv('MAX_NEWS_PER_SOURCE', 3),
  yugiohNewsUrl: process.env.YUGIOH_NEWS_URL?.trim() || 'https://www.yugioh-card.com/eu/es/noticias/',
  pokemonNewsUrl: process.env.POKEMON_NEWS_URL?.trim() || 'https://www.pokemon.com/el/noticias-pokemon',
  enablePokemonFallback: booleanEnv('ENABLE_POKEMON_FALLBACK', true),
  pokemonFallbackNewsUrl: process.env.POKEMON_FALLBACK_NEWS_URL?.trim() || 'https://vandal.elespanol.com/noticias/noticias-sobre-pokemon',
  sentNewsFile: process.env.SENT_NEWS_FILE?.trim() || 'sent-news.json',
  httpTimeoutMs: numberEnv('HTTP_TIMEOUT_MS', 15000),
  sendExistingOnStart: booleanEnv('SEND_EXISTING_ON_START', false)
};

if (!['everyone', 'role', 'none'].includes(config.mentionMode)) {
  throw new Error('MENTION_MODE must be one of: everyone, role, none');
}

if (config.mentionMode === 'role' && !config.newsRoleId) {
  throw new Error('NEWS_ROLE_ID is required when MENTION_MODE=role');
}
