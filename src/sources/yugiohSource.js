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
    'enlace'
  ].includes(normalized);
}

function looksLikeNewsTitle(title) {
  const normalized = normalizeText(title);

  if (!normalized) return false;
  if (normalized.length < 25) return false;
  if (isIgnoredTitle(normalized)) return false;

  return true;
}

function looksLikeNewsUrl(url) {
  const normalized = String(url || '').toLowerCase();

  if (!normalized) return false;

  if (normalized.includes('/eu/es/noticias/')) return true;
  if (normalized.includes('/eu/es/news/')) return true;
  if (normalized.includes('?p=')) return true;
  if (normalized.includes('/?p=')) return true;

  return false;
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
  const rawText = normalizeText($(element).text());

  if (!href || !rawText) return null;

  const url = absoluteUrl(href);

  if (seen.has(url)) return null;
  if (!looksLikeNewsUrl(url) && !rawText.toLowerCase().includes('yu-gi-oh')) return null;

  const container = $(element).closest('article, .post, .news, .card, .item, li, div');
  const containerText = normalizeText(container.text()) || rawText;

  const date = normalizeText(container.find('time').first().text()) || findDate(containerText);
  const title = cleanTitle(rawText);

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

    if (articles.length === 0) {
      const pageText = normalizeText($('body').text());

      const fallbackMatches = pageText.matchAll(
        /(Noticias|News|Actualizar|Update)\s+(\d{1,2}\s+\w+\s+\d{4})\s+(.+?)(?=\s+(Noticias|News|Actualizar|Update)\s+\d{1,2}\s+\w+\s+\d{4}|Page\s+\d+|View All|Social Media|$)/gi
      );

      for (const match of fallbackMatches) {
        const date = normalizeText(match[2]);
        const titleAndSummary = normalizeText(match[3]).replace(/\s+More\s*$/i, '');
        const title = cleanTitle(titleAndSummary.split('. ')[0]);

        if (!looksLikeNewsTitle(title)) continue;

        const id = `${config.yugiohNewsUrl}#${encodeURIComponent(title)}`;

        if (seen.has(id)) continue;
        seen.add(id);

        articles.push({
          source: 'Yu-Gi-Oh!',
          id,
          title,
          summary: titleAndSummary.slice(0, 500),
          date,
          url: config.yugiohNewsUrl,
          imageUrl: ''
        });
      }
    }

    if (articles.length === 0) {
      throw new Error('Parser error: no news found for Yu-Gi-Oh!');
    }

    return articles.slice(0, config.maxNewsPerSource);
  }
};