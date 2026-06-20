const BLOCK_PATTERNS = [
  'incapsula',
  '_incapsula_resource',
  'access denied',
  'request blocked',
  'captcha',
  'temporarily unavailable',
  'forbidden',
  'bot detection'
];

export function classifySourceError(error) {
  const bodyPreview = String(error.bodyPreview || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  const status = Number(error.status || 0);

  if ([401, 403, 429].includes(status)) {
    return {
      type: 'BLOCKED',
      severity: 'warning',
      reason: `HTTP ${status} suggests blocking, rate limiting or unauthorized access`
    };
  }

  if (BLOCK_PATTERNS.some((pattern) => bodyPreview.includes(pattern) || message.includes(pattern))) {
    return {
      type: 'BLOCKED',
      severity: 'warning',
      reason: 'Response content suggests anti-bot, captcha or access blocking'
    };
  }

  if (status >= 500) {
    return {
      type: 'SOURCE_UNAVAILABLE',
      severity: 'warning',
      reason: `Source returned HTTP ${status}`
    };
  }

  if (status === 0 || message.includes('timeout')) {
    return {
      type: 'TIMEOUT',
      severity: 'warning',
      reason: 'The source did not respond before timeout'
    };
  }

  if (message.includes('no news found') || message.includes('parser')) {
    return {
      type: 'PARSING_ERROR',
      severity: 'warning',
      reason: 'The page structure may have changed or no articles were detected'
    };
  }

  return {
    type: 'UNKNOWN_ERROR',
    severity: 'error',
    reason: 'Unexpected source processing error'
  };
}
