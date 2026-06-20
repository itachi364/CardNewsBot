import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

function buildNewsMention() {
  if (config.mentionMode === 'everyone') return '@everyone';
  if (config.mentionMode === 'role') return `<@&${config.newsRoleId}>`;
  return '';
}

function buildNewsAllowedMentions() {
  if (config.mentionMode === 'everyone') return { parse: ['everyone'] };
  if (config.mentionMode === 'role') return { parse: [], roles: [config.newsRoleId] };
  return { parse: [] };
}

function sourceIcon(source) {
  if (source === 'Yu-Gi-Oh!') return '🃏';
  if (source === 'Pokémon') return '⚡';
  return '📰';
}

export async function publishNews(client, item) {
  const channel = await client.channels.fetch(config.newsChannelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    throw new Error(`Invalid news channel: ${config.newsChannelId}`);
  }

  const embed = new EmbedBuilder()
    .setColor(item.source === 'Yu-Gi-Oh!' ? 0x7b1fa2 : 0xffcb05)
    .setTitle(item.title)
    .setURL(item.url)
    .setDescription(item.summary || `Nueva noticia publicada en ${item.source}.`)
    .addFields(
      { name: 'Fuente', value: item.source, inline: true },
      { name: 'Fecha', value: item.date || 'No definida', inline: true }
    )
    .setTimestamp();

  if (item.imageUrl) {
    embed.setImage(item.imageUrl);
  }

  const mention = buildNewsMention();
  const content = `${mention} ${sourceIcon(item.source)} **Nueva noticia de ${item.source}:** ${item.title}`.trim();

  await channel.send({
    content,
    embeds: [embed],
    allowedMentions: buildNewsAllowedMentions()
  });
}
