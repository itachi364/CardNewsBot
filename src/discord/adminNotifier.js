import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { classifySourceError } from '../utils/errorClassifier.js';

const lastAdminAlerts = new Map();

function shouldNotify(key) {
  const cooldownMs = config.adminAlertCooldownMinutes * 60 * 1000;
  const last = lastAdminAlerts.get(key) || 0;
  const now = Date.now();

  if (now - last < cooldownMs) {
    return false;
  }

  lastAdminAlerts.set(key, now);
  return true;
}

function safeErrorText(error) {
  const message = error?.message || 'Unknown error';
  return message.length > 900 ? `${message.slice(0, 900)}...` : message;
}

export async function notifyAdminSourceError(client, source, error) {
  const classification = classifySourceError(error);
  const alertKey = `${source.name}:${classification.type}`;

  console.error(`[${source.name}] ${classification.type}: ${classification.reason}. ${error.message}`);

  if (!shouldNotify(alertKey)) {
    return;
  }

  const channel = await client.channels.fetch(config.adminLogChannelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.error(`Invalid admin log channel: ${config.adminLogChannelId}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(classification.type === 'BLOCKED' ? 0xff9900 : 0xff3333)
    .setTitle(`⚠️ Problema consultando ${source.name}`)
    .setDescription('Una fuente de noticias falló, pero el bot continuará intentando las demás fuentes.')
    .addFields(
      { name: 'Fuente', value: source.name, inline: true },
      { name: 'Tipo', value: classification.type, inline: true },
      { name: 'Motivo', value: classification.reason, inline: false },
      { name: 'URL', value: source.url, inline: false },
      { name: 'Error', value: safeErrorText(error), inline: false }
    )
    .setTimestamp();

  await channel.send({
    content: `<@&${config.adminRoleId}> revisar fuente de noticias: ${source.name}`,
    embeds: [embed],
    allowedMentions: { parse: [], roles: [config.adminRoleId] }
  });
}
