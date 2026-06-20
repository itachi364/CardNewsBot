import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { fetchHtml } from '../utils/httpClient.js';

function absoluteUrl(url) {
  return new URL(url, config.pokemonNewsUrl).toString();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isIgnoredTitle(title) {
  const normalized = normalizeText(title).toLowerCase();

  return [
    'todas las noticias',
    'noticias pokémon',
    'noticias pokemon',
    'pokemon news',
    'all news',
    'news',
    'más noticias',
    'mas noticias',
    'ver más',
    'ver mas',
    'leer más',
    'leer mas'
  ].includes(normalized);
}

function looksLikeArticleUrl(url) {
  const normalized = String(url || '').toLowerCase();

  if (!normalized) return false;

  if (normalized.endsWith('/noticias-pokemon')) return false;
  if (normalized.endsWith('/noticias-pokemon/')) return false;
  if (normalized.endsWith('/pokemon-news')) return false;
  if (normalized.endsWith('/pokemon-news/')) return false;

  return normalized.includes('/noticias-pokemon/') || normalized.includes('/pokemon-news/');
}

function looksLikeNewsTitle(title) {
  const normalized = normalizeText(title);

  if (!normalized) return false;
  if (normalized.length < 12) return false;
  if (isIgnoredTitle(normalized)) return false;

  return true;
}

function extractTitle($, element) {
  const heading = normalizeText($(element).find('h1,h2,h3,h4').first().text());
  if (heading) return heading;

  return normalizeText($(element).text());
}

function extractDate(container) {
  return (
    normalizeText(container.find('time').first().text()) ||
    normalizeText(container.find('.date').first().text()) ||
    normalizeText(container.find('[class*="date"]').first().text())
  );
}

function extractSummary(container, title) {
  const summary = normalizeText(container.find('p').first().text());

  if (summary && summary !== title) {
    return summary.slice(0, 500);
  }

  return '';
}

export const pokemonSource = {
  name: 'Pokémon',
  url: config.pokemonNewsUrl,

  async fetchLatest() {
    const html = await fetchHtml(config.pokemonNewsUrl);
    const $ = cheerio.load(html);
    const articles = [];
    const seen = new Set();

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');

      if (!href) return;

      const url = absoluteUrl(href);

      if (!looksLikeArticleUrl(url)) return;
      if (seen.has(url)) return;

      const title = extractTitle($, element);

      if (!looksLikeNewsTitle(title)) return;

      const container = $(element).closest('article, .card, .news, li, div');
      const summary = extractSummary(container, title);
      const date = extractDate(container);
      const imageSrc = container.find('img').first().attr('src');

      seen.add(url);

      articles.push({
        source: 'Pokémon',
        id: url,
        title,
        summary,
        date,
        url,
        imageUrl: imageSrc ? absoluteUrl(imageSrc) : ''
      });
    });

    return articles.slice(0, config.maxNewsPerSource);
  }
};
