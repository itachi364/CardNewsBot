import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { fetchHtml } from '../utils/httpClient.js';

function absoluteUrl(url) {
  return new URL(url, config.yugiohNewsUrl).toString();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isIgnoredTitle(title) {
  const normalized = normalizeText(title).toLowerCase();

  return [
    'all',
    'more',
    'view all',
    'next page',
    'noticias',
    'eventos',
    'actualizar',
    'speed duel',
    'enlace',
    'official tournament stores',
    'ots',
    'where to buy',
    'support',
    'contact us'
  ].includes(normalized);
}

function looksLikeNewsTitle(title) {
  const normalized = normalizeText(title);

  if (!normalized) return false;
  if (normalized.length < 25) return false;
  if (isIgnoredTitle(normalized)) return false;

  return true;
}

function looksLikeArticleUrl(url) {
  const normalized = String(url || '').toLowerCase();
  const base = config.yugiohNewsUrl.replace(/\/$/, '').toLowerCase();

  if (!normalized) return false;
  if (normalized.includes('#')) return false;
  if (normalized === base || normalized === `${base}/`) return false;
  if (normalized.endsWith('/noticias') || normalized.endsWith('/noticias/')) return false;
  if (normalized.endsWith('/news') || normalized.endsWith('/news/')) return false;

  return normalized.startsWith('https://www.yugioh-card.com/eu/es/');
}

function findDate(text) {
  const normalized = normalizeText(text);

  const patterns = [
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
  let value = normalizeText(title);

  value = value.replace(/^(noticias|news|actualizar|update|eventos|events)\s+/i, '');
  value = value.replace(/^\d{1,2}\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4}\s+/i, '');
  value = value.replace(/^\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s+/i, '');
  value = value.replace(/\s+more$/i, '');

  return normalizeText(value);
}

function extractTitle($, element, container) {
  const headingFromLink = normalizeText($(element).find('h1,h2,h3,h4').first().text());
  if (headingFromLink) return cleanTitle(headingFromLink);

  const headingFromContainer = normalizeText(container.find('h1,h2,h3,h4').first().text());
  if (headingFromContainer) return cleanTitle(headingFromContainer);

  return cleanTitle($(element).text());
}

function extractSummary(container, title) {
  const paragraphSummary = normalizeText(container.find('p').first().text());

  if (paragraphSummary && paragraphSummary !== title) {
    return paragraphSummary.slice(0, 500);
  }

  const fullText = normalizeText(container.text());
  const cleanedTitle = normalizeText(title);

  if (!fullText || !cleanedTitle) return '';

  const withoutTitle = fullText.replace(cleanedTitle, '');
  const withoutNoise = withoutTitle
    .replace(/^(noticias|news|actualizar|update|eventos|events)\s*/i, '')
    .replace(/\bmore\b/gi, '')
    .trim();

  return normalizeText(withoutNoise).slice(0, 500);
}

function buildArticleFromLink($, element, seen) {
  const href = $(element).attr('href');

  if (!href) return null;

  const url = absoluteUrl(href);

  if (seen.has(url)) return null;
  if (!looksLikeArticleUrl(url)) return null;

  const container = $(element).closest('article, .post, .news, .card, .item, li, div');
  const containerText = normalizeText(container.text());
  const date = normalizeText(container.find('time').first().text()) || findDate(containerText);
  const title = extractTitle($, element, container);

  if (!looksLikeNewsTitle(title)) return null;

  const summary = extractSummary(container, title);
  const imageSrc = container.find('img').first().attr('src');

  seen.add(url);

  return {
    source: 'Yu-Gi-Oh!',
    id: url,
    title,
    summary,
    date,
    url,
    imageUrl: imageSrc ? absoluteUrl(imageSrc) : ''
  };
}

export const yugiohSource = {
  name: 'Yu-Gi-Oh!',
  url: config.yugiohNewsUrl,

  async fetchLatest() {
    const html = await fetchHtml(config.yugiohNewsUrl);
    const $ = cheerio.load(html);
    const articles = [];
    const seen = new Set();

    $('main a[href], article a[href], .news a[href], .post a[href], .card a[href], a[href]').each((_, element) => {
      const article = buildArticleFromLink($, element, seen);

      if (article) {
        articles.push(article);
      }
    });

    return articles.slice(0, config.maxNewsPerSource);
  }
};
