import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { fetchHtml } from '../utils/httpClient.js';

function absoluteUrl(url) {
  return new URL(url, config.pokemonNewsUrl).toString();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeForCompare(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isIgnoredTitle(title) {
  const normalized = normalizeForCompare(title);

  return [
    'todas las noticias',
    'noticias pokemon',
    'pokemon news',
    'all news',
    'news',
    'mas noticias',
    'ver mas',
    'leer mas'
  ].includes(normalized);
}

function looksLikeArticleUrl(url) {
  const normalized = String(url || '').toLowerCase().replace(/\/$/, '');
  const indexEs = config.pokemonNewsUrl.toLowerCase().replace(/\/$/, '');
  const indexEn = 'https://www.pokemon.com/us/pokemon-news';

  if (!normalized) return false;
  if (normalized === indexEs || normalized === indexEn) return false;

  return normalized.includes('/noticias-pokemon/') || normalized.includes('/pokemon-news/');
}

function looksLikeNewsTitle(title) {
  const normalized = normalizeText(title);

  if (!normalized) return false;
  if (normalized.length < 12) return false;
  if (isIgnoredTitle(normalized)) return false;

  return true;
}

function findDate(text) {
  const normalized = normalizeText(text);

  const patterns = [
    /\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}\b/i,
    /\b\d{1,2}\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4}\b/i,
    /\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[0];
  }

  return '';
}

function cleanTitle(title) {
  return normalizeText(title)
    .replace(/^\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}\s*/i, '')
    .replace(/^\d{1,2}\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4}\s*/i, '')
    .replace(/^(dibujos animados|videojuegos y aplicaciones|juego de cartas coleccionables)\s*/i, '')
    .replace(/\s+leer mas$/i, '')
    .replace(/\s+leer más$/i, '');
}

function titleFromSlug(url) {
  const pathname = new URL(url).pathname;
  const slug = pathname.split('/').filter(Boolean).pop() || '';

  return slug
    .replace(/-/g, ' ')
    .replace(/\bjcc\b/gi, 'JCC')
    .replace(/\bpokemon\b/gi, 'Pokémon')
    .replace(/\bde\b/g, 'de')
    .replace(/\bla\b/g, 'la')
    .replace(/\bel\b/g, 'el')
    .replace(/\ben\b/g, 'en')
    .replace(/\bun\b/g, 'un')
    .replace(/\buna\b/g, 'una')
    .replace(/^./, (char) => char.toUpperCase());
}

function extractTitle($, element, container, url) {
  const candidates = [
    $(element).find('h1,h2,h3,h4,[class*="title"],[class*="headline"]').first().text(),
    container.find('h1,h2,h3,h4,[class*="title"],[class*="headline"]').first().text(),
    $(element).attr('title'),
    $(element).attr('aria-label')
  ];

  for (const candidate of candidates) {
    const title = cleanTitle(candidate);
    if (looksLikeNewsTitle(title)) return title;
  }

  const containerText = normalizeText(container.text());
  const date = findDate(containerText);
  const withoutDate = date ? containerText.replace(date, '') : containerText;
  const parts = withoutDate
    .split(/(?<=[.!?])\s+/)
    .map(cleanTitle)
    .filter(looksLikeNewsTitle);

  if (parts[0]) return parts[0];

  return titleFromSlug(url);
}

function extractDate(container) {
  const explicitDate = (
    normalizeText(container.find('time').first().text()) ||
    normalizeText(container.find('.date').first().text()) ||
    normalizeText(container.find('[class*="date"]').first().text())
  );

  return explicitDate || findDate(container.text());
}

function extractSummary(container, title) {
  const summary = normalizeText(container.find('p').first().text());

  if (summary && summary !== title) {
    return summary.slice(0, 500);
  }

  return '';
}

function extractImage(container) {
  const image = container.find('img').first();
  const src = image.attr('src') || image.attr('data-src') || image.attr('data-original');

  if (src) return absoluteUrl(src);

  const srcset = image.attr('srcset') || image.attr('data-srcset');
  if (!srcset) return '';

  const firstSrc = srcset.split(',')[0]?.trim().split(/\s+/)[0];
  return firstSrc ? absoluteUrl(firstSrc) : '';
}

function findArticleLinksFromHtml(html) {
  const matches = html.matchAll(/href=["']([^"']*(?:\/noticias-pokemon\/|\/pokemon-news\/)[^"']+)["']/gi);
  const urls = [];

  for (const match of matches) {
    const url = absoluteUrl(match[1]);

    if (looksLikeArticleUrl(url)) {
      urls.push(url);
    }
  }

  return urls;
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

      const container = $(element).closest('article, .card, .news, .news-card, li, div');
      const title = extractTitle($, element, container, url);

      if (!looksLikeNewsTitle(title)) return;

      const summary = extractSummary(container, title);
      const date = extractDate(container);
      const imageUrl = extractImage(container);

      seen.add(url);

      articles.push({
        source: 'Pokémon',
        id: url,
        title,
        summary,
        date,
        url,
        imageUrl
      });
    });

    for (const url of findArticleLinksFromHtml(html)) {
      if (seen.has(url)) continue;

      const title = titleFromSlug(url);
      if (!looksLikeNewsTitle(title)) continue;

      seen.add(url);

      articles.push({
        source: 'Pokémon',
        id: url,
        title,
        summary: '',
        date: '',
        url,
        imageUrl: ''
      });
    }

    return articles.slice(0, config.maxNewsPerSource);
  }
};
