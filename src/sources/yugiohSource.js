import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { fetchHtml } from '../utils/httpClient.js';

function absoluteUrl(url) {
  return new URL(url, config.yugiohNewsUrl).toString();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export const yugiohSource = {
  name: 'Yu-Gi-Oh!',
  url: config.yugiohNewsUrl,

  async fetchLatest() {
    const html = await fetchHtml(config.yugiohNewsUrl);
    const $ = cheerio.load(html);
    const articles = [];
    const seen = new Set();

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const title = normalizeText($(element).text());

      if (!href || !title) return;
      if (title.length < 12) return;
      if (!href.includes('/noticias/') && !href.includes('/news/')) return;

      const url = absoluteUrl(href);
      if (seen.has(url)) return;
      seen.add(url);

      const container = $(element).closest('article, .post, .news, .card, li, div');
      const summary = normalizeText(container.find('p').first().text());
      const date = normalizeText(container.find('time').first().text()) || normalizeText(container.find('.date, .posted-on').first().text());
      const imageSrc = container.find('img').first().attr('src');

      articles.push({
        source: 'Yu-Gi-Oh!',
        id: url,
        title,
        summary,
        date,
        url,
        imageUrl: imageSrc ? absoluteUrl(imageSrc) : ''
      });
    });

    if (articles.length === 0) {
      throw new Error('Parser error: no news found for Yu-Gi-Oh!');
    }

    return articles.slice(0, config.maxNewsPerSource);
  }
};
