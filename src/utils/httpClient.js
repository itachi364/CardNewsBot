import { fetch } from 'undici';
import { config } from '../config.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache'
};

export class HttpError extends Error {
  constructor(message, { status, url, bodyPreview }) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.bodyPreview = bodyPreview;
  }
}

export async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.httpTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      redirect: 'follow'
    });

    const body = await response.text();

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} fetching ${url}`, {
        status: response.status,
        url,
        bodyPreview: body.slice(0, 500)
      });
    }

    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new HttpError(`Timeout fetching ${url}`, {
        status: 0,
        url,
        bodyPreview: ''
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
