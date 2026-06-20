import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

const adminAlertCooldowns = new Map();

function shouldNotifyAdmin(sourceName) {
  const now = Date.now();
  const lastAlertAt = adminAlertCooldowns.get(sourceName) || 0;
  const cooldownMs = config.adminAlertCooldownMinutes * 60 * 1000;

  if (now - lastAlertAt < cooldownMs) {
    return false;
  }

  adminAlertCooldowns.set(sourceName, now);
  return true;
}

function buildAdminMention() {
  if (!config.adminRoleId) {
    return '';
  }

  return `<@&${config.adminRoleId}>`;
}

export async function notifyAdminSourceError(client, source, errorInfo) {
  if (!config.adminLogChannelId) {
    console.error(`[${source.name}] ADMIN_LOG_CHANNEL_ID is not configured.`);
    return;
  }

  if (!shouldNotifyAdmin(source.name)) {
    return;
  }

  try {
    const channel = await client.channels.fetch(config.adminLogChannelId).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.error(`[${source.name}] Admin log channel is not accessible or is not text based: ${config.adminLogChannelId}`);
      return;
    }

    const mention = buildAdminMention();

    const embed = new EmbedBuilder()
      .setColor(0xff3b3b)
      .setTitle(`⚠️ Problema consultando ${source.name}`)
      .setDescription('Una fuente de noticias falló, pero el bot continuará intentando las demás fuentes.')
      .addFields(
        { name: 'Fuente', value: source.name, inline: true },
        { name: 'URL', value: source.url || 'No definida', inline: false },
        { name: 'Tipo', value: errorInfo.type || 'UNKNOWN', inline: true },
        { name: 'Estado HTTP', value: String(errorInfo.statusCode || 'N/A'), inline: true },
        { name: 'Detalle', value: String(errorInfo.message || 'Sin detalle').slice(0, 1000), inline: false }
      )
      .setTimestamp();

    await channel.send({
      content: `${mention} revisar fuente de noticias: ${source.name}`.trim(),
      embeds: [embed],
      allowedMentions: config.adminRoleId
        ? { parse: [], roles: [config.adminRoleId] }
        : { parse: [] }
    });
  } catch (error) {
    console.error(`[${source.name}] Could not send admin alert to Discord.`);
    console.error(error);
  }
}