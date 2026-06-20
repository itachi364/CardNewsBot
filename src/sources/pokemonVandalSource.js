import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { fetchHtml } from '../utils/httpClient.js';

function absoluteUrl(url) {
  return new URL(url, config.pokemonFallbackNewsUrl).toString();
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
    'pokemon',
    'noticias sobre pokemon',
    'noticias pokemon',
    'ultimas noticias',
    'leer mas',
    'ver mas',
    'vandal'
  ].includes(normalized);
}

function looksLikePokemonArticleUrl(url) {
  const normalized = String(url || '').toLowerCase();
  const base = config.pokemonFallbackNewsUrl.toLowerCase().replace(/\/$/, '');

  if (!normalized) return false;
  if (normalized.replace(/\/$/, '') === base) return false;
  if (normalized.includes('#')) return false;

  return (
    normalized.includes('vandal.elespanol.com/noticia') ||
    normalized.includes('vandal.elespanol.com/noticias/')
  );
}

function looksLikePokemonTitle(title, url) {
  const clean = normalizeText(title);
  const comparable = normalizeForCompare(clean);
  const normalizedUrl = String(url || '').toLowerCase();

  if (!clean) return false;
  if (clean.length < 16) return false;
  if (isIgnoredTitle(clean)) return false;

  return comparable.includes('pokemon') || normalizedUrl.includes('pokemon');
}

function titleFromSlug(url) {
  const pathname = new URL(url).pathname;
  const slug = pathname.split('/').filter(Boolean).pop() || '';

  return slug
    .replace(/^\d+-?/, '')
    .replace(/-/g, ' ')
    .replace(/\bpokemon\b/gi, 'Pokémon')
    .replace(/\bjcc\b/gi, 'JCC')
    .replace(/^./, (char) => char.toUpperCase());
}

function findDate(text) {
  const normalized = normalizeText(text);
  const patterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
    /\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}\b/i,
    /\b\d{1,2}\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4}\b/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[0];
  }

  return '';
}

function extractTitle($, element, container, url) {
  const candidates = [
    $(element).find('h1,h2,h3,h4,[class*="tit"],[class*="title"]').first().text(),
    container.find('h1,h2,h3,h4,[class*="tit"],[class*="title"]').first().text(),
    $(element).attr('title'),
    $(element).attr('aria-label'),
    $(element).text()
  ];

  for (const candidate of candidates) {
    const title = normalizeText(candidate);
    if (looksLikePokemonTitle(title, url)) return title;
  }

  return titleFromSlug(url);
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

export const pokemonVandalSource = {
  name: 'Pokémon - Vandal',
  url: config.pokemonFallbackNewsUrl,

  async fetchLatest() {
    if (!config.enablePokemonFallback) {
      return [];
    }

    const html = await fetchHtml(config.pokemonFallbackNewsUrl);
    const $ = cheerio.load(html);
    const articles = [];
    const seen = new Set();

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      const url = absoluteUrl(href);
      if (!looksLikePokemonArticleUrl(url)) return;
      if (seen.has(url)) return;

      const container = $(element).closest('article, .noticia, .news, .card, li, div');
      const title = extractTitle($, element, container, url);

      if (!looksLikePokemonTitle(title, url)) return;

      seen.add(url);

      articles.push({
        source: 'Pokémon - Vandal',
        id: url,
        title,
        summary: extractSummary(container, title),
        date: findDate(container.text()),
        url,
        imageUrl: extractImage(container)
      });
    });

    return articles.slice(0, config.maxNewsPerSource);
  }
};
