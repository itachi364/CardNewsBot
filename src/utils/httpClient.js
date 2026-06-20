import { fetch } from 'undici';
import { config } from '../config.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache'
};

const BLOCK_PATTERNS = [
  /incapsula/i,
  /request unsuccessful/i,
  /incident id/i,
  /access denied/i,
  /request blocked/i,
  /captcha/i,
  /_incapsula_resource/i,
  /distil_r_blocked/i,
  /akamai/i
];

export class HttpError extends Error {
  constructor(message, { status, url, bodyPreview, type = 'HTTP_ERROR' }) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.statusCode = status;
    this.url = url;
    this.bodyPreview = bodyPreview;
    this.type = type;
  }
}

function isBlockedBody(body) {
  return BLOCK_PATTERNS.some((pattern) => pattern.test(body));
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

    if (isBlockedBody(body)) {
      throw new HttpError(`Possible anti-bot block fetching ${url}`, {
        status: response.status,
        url,
        bodyPreview: body.slice(0, 500),
        type: 'BLOCKED'
      });
    }

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} fetching ${url}`, {
        status: response.status,
        url,
        bodyPreview: body.slice(0, 500),
        type: response.status === 403 || response.status === 429 ? 'BLOCKED' : 'HTTP_ERROR'
      });
    }

    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new HttpError(`Timeout fetching ${url}`, {
        status: 0,
        url,
        bodyPreview: '',
        type: 'TIMEOUT'
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
