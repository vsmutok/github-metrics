// Pre-warms GitHub's camo cache for our README embeds.
//
// GitHub does not fetch README images on a schedule: camo pulls the image
// lazily the first time a viewer opens the page. To avoid that cold, slow
// fetch happening during the day we scan the rendered GitHub page for the
// camo URLs that point back at our own host and request them on a nightly
// cron, so camo already holds a fresh copy when real visitors arrive.

import { httpRequest } from '../utils/http-client.js';

const CAMO_URL_PATTERN = /https:\/\/camo\.githubusercontent\.com\/[0-9a-fA-F]+\/[0-9a-fA-F]+/g;
const CAMO_URL_EXACT = /^https:\/\/camo\.githubusercontent\.com\/[0-9a-fA-F]+\/([0-9a-fA-F]+)$/;

/** Camo encodes the original URL as a hex string after the HMAC segment. */
export function decodeCamoTarget(camoUrl) {
  const match = CAMO_URL_EXACT.exec(camoUrl);
  if (!match) {
    return null;
  }
  try {
    return Buffer.from(match[1], 'hex').toString('utf8');
  } catch {
    return null;
  }
}

/** True when the decoded target points at one of the allowed hosts. */
export function hostMatches(targetUrl, hosts) {
  try {
    const { host } = new URL(targetUrl);
    return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/** Fetch a GitHub page and return the camo URLs that point at our hosts. */
export async function collectCamoUrls(pageUrl, hosts, { fetchImpl } = {}) {
  const response = await httpRequest(pageUrl, {
    responseType: 'text',
    timeoutMs: 20000,
    fetchImpl,
  });

  if (!response.success) {
    throw new Error(`Failed to load ${pageUrl}: ${response.status || response.error?.message || 'unknown error'}`);
  }

  const found = new Set(response.data.match(CAMO_URL_PATTERN) || []);
  const urls = [];
  for (const camoUrl of found) {
    const target = decodeCamoTarget(camoUrl);
    if (target && hostMatches(target, hosts)) {
      urls.push(camoUrl);
    }
  }
  return urls;
}

/**
 * Scan each page for our camo URLs and request them so camo refreshes its
 * cache. Returns a summary suitable for logging / a cron response body.
 */
export async function warmCamoCache({ pages = [], hosts = [], timeoutMs = 20000, fetchImpl } = {}) {
  const summary = { warmed: 0, failed: 0, pages: {}, results: [], errors: [] };

  for (const page of pages) {
    try {
      const camoUrls = await collectCamoUrls(page, hosts, { fetchImpl });
      summary.pages[page] = camoUrls.length;

      for (const camoUrl of camoUrls) {
        const response = await httpRequest(camoUrl, {
          responseType: 'none',
          timeoutMs,
          fetchImpl,
        });
        const ok = response.success;
        summary.results.push({ url: camoUrl, ok, status: response.status || 0 });
        if (ok) {
          summary.warmed += 1;
        } else {
          summary.failed += 1;
        }
      }
    } catch (error) {
      summary.pages[page] = 0;
      summary.errors.push(`${page}: ${error.message}`);
    }
  }

  return summary;
}

export default { decodeCamoTarget, hostMatches, collectCamoUrls, warmCamoCache };
