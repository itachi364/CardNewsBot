import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { publishNews } from './discord/newsPublisher.js';
import { notifyAdminSourceError } from './discord/adminNotifier.js';
import { SentNewsStore } from './storage/sentNewsStore.js';
import { yugiohSource } from './sources/yugiohSource.js';
import { pokemonSource } from './sources/pokemonSource.js';

const sources = [yugiohSource, pokemonSource];
const store = new SentNewsStore();
let isPolling = false;
let hasRunInitialCycle = false;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

async function processSource(source) {
  try {
    const latestNews = await source.fetchLatest();
    let published = 0;

    for (const item of latestNews.reverse()) {
      if (store.has(item.id)) {
        continue;
      }

      if (!hasRunInitialCycle) {
        await store.markAsSent(item);
        continue;
      }

      await publishNews(client, item);
      await store.markAsSent(item);
      published += 1;
    }

    if (published > 0) {
      console.log(`[${source.name}] Published ${published} new article(s)`);
    }
  } catch (error) {
    await notifyAdminSourceError(client, source, error);
  }
}

async function pollAllSources() {
  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    for (const source of sources) {
      await processSource(source);
    }

    hasRunInitialCycle = true;
  } finally {
    isPolling = false;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  await store.load();

  const newsChannel = await readyClient.channels.fetch(config.newsChannelId).catch(() => null);
  const adminChannel = await readyClient.channels.fetch(config.adminLogChannelId).catch(() => null);

  if (!newsChannel || !newsChannel.isTextBased()) {
    console.error(`Invalid NEWS_CHANNEL_ID: ${config.newsChannelId}`);
    process.exit(1);
  }

  if (!adminChannel || !adminChannel.isTextBased()) {
    console.error(`Invalid ADMIN_LOG_CHANNEL_ID: ${config.adminLogChannelId}`);
    process.exit(1);
  }

  console.log(`CardNewsBot connected as ${readyClient.user.tag}`);
  console.log(`Polling every ${config.pollIntervalMinutes} minute(s)`);

  await pollAllSources();
  setInterval(pollAllSources, config.pollIntervalMinutes * 60 * 1000);
});

client.login(config.discordToken);
