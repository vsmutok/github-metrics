import { renderBackground, wrapSvg, renderCard, LAYOUT, getTheme } from './svg.renderer.js';

const ERROR_COPY = {
  NOT_FOUND: {
    title: 'User Not Found',
    message: 'This GitHub username does not exist or is not accessible.',
    hint: 'Check the spelling in your README embed URL.',
  },
  RATE_LIMIT: {
    title: 'Rate Limit Reached',
    message: 'GitHub API rate limit exceeded.',
    hint: 'The dashboard will recover once limits reset.',
  },
  API_DOWN: {
    title: 'GitHub API Unavailable',
    message: 'GitHub is temporarily unreachable.',
    hint: 'Try refreshing your profile in a few minutes.',
  },
  NETWORK: {
    title: 'Connection Error',
    message: 'Could not reach GitHub.',
    hint: 'Check your connection or try again shortly.',
  },
  API_ERROR: {
    title: 'Unable to Load Profile',
    message: 'Something went wrong while fetching GitHub data.',
    hint: 'Verify your username and try again.',
  },
  INVALID_USERNAME: {
    title: 'Invalid GitHub Username',
    message: 'Usernames must be 1–39 characters: letters, numbers, or hyphens.',
    hint: 'Cannot start or end with a hyphen.',
  },
};

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders a themed error dashboard SVG inside the github-metrics frame.
 */
export function renderGracefulError({ code = 'API_ERROR', username, detail }) {
  const copy = ERROR_COPY[code] || ERROR_COPY.API_ERROR;
  const { colors } = getTheme();
  const width = LAYOUT.width;
  const height = 240;
  const padding = LAYOUT.padding;
  const cardWidth = width - padding * 2;
  const cardHeight = 168;
  const cardX = padding;
  const cardY = 50;
  const centerX = width / 2;

  const usernameLine = username ? `@${escapeXml(username)}` : '';
  const detailLine = detail ? escapeXml(detail) : '';

  const content = [
    renderBackground(width, height),
    `<text x="${padding}" y="36" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="17" font-weight="700" fill="${colors.primaryText}">github-metrics</text>`,
    `<text x="${width - padding}" y="36" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" fill="${colors.mutedText}" text-anchor="end">dashboard</text>`,
    renderCard({ x: cardX, y: cardY, width: cardWidth, height: cardHeight, title: 'Status' }),
    `<circle cx="${centerX}" cy="${cardY + 58}" r="24" fill="${colors.error}" opacity="0.12"/>`,
    `<text x="${centerX}" y="${cardY + 66}" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${colors.error}" text-anchor="middle">!</text>`,
    `<text x="${centerX}" y="${cardY + 98}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="19" font-weight="700" fill="${colors.error}" text-anchor="middle">${escapeXml(copy.title)}</text>`,
    usernameLine
      ? `<text x="${centerX}" y="${cardY + 118}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" fill="${colors.accent}" text-anchor="middle">${usernameLine}</text>`
      : '',
    `<text x="${centerX}" y="${cardY + (usernameLine ? 136 : 120)}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" fill="${colors.secondaryText}" text-anchor="middle">${escapeXml(copy.message)}</text>`,
    `<text x="${centerX}" y="${cardY + (usernameLine ? 154 : 138)}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" fill="${colors.mutedText}" text-anchor="middle">${escapeXml(copy.hint)}</text>`,
    detailLine
      ? `<text x="${centerX}" y="${cardY + 182}" font-family="monospace" font-size="10" fill="${colors.mutedText}" text-anchor="middle" opacity="0.7">${detailLine}</text>`
      : '',
  ].filter(Boolean).join('\n');

  return wrapSvg(content, width, height);
}

/** Sends graceful error SVG (HTTP 200 so README img embeds do not break). */
export function sendGracefulErrorSvg(res, { code, username, detail }) {
  const svg = renderGracefulError({ code, username, detail });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(svg);
}
