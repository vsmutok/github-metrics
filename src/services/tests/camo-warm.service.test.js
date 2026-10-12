import { describe, expect, jest, test } from '@jest/globals';
import {
  collectCamoUrls,
  decodeCamoTarget,
  hostMatches,
  warmCamoCache,
} from '../camo-warm.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OUR_URL = 'https://ghmetric.vercel.app/api/profile?username=vsmutok';
const OTHER_URL = 'https://example.com/some/avatar.png';
const CAMO_HASH = 'a'.repeat(40);

function camoUrl(target) {
  return `https://camo.githubusercontent.com/${CAMO_HASH}/${Buffer.from(target).toString('hex')}`;
}

function textResponse(body, init = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    url: init.url || 'https://github.com/mock',
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('camo-warm.service.js', () => {
  test('decodeCamoTarget round-trips the original URL', () => {
    expect(decodeCamoTarget(camoUrl(OUR_URL))).toBe(OUR_URL);
    expect(decodeCamoTarget('https://camo.githubusercontent.com/not-valid')).toBeNull();
  });

  test('hostMatches accepts exact and subdomain hosts only', () => {
    expect(hostMatches(OUR_URL, ['ghmetric.vercel.app'])).toBe(true);
    expect(hostMatches('https://x.ghmetric.vercel.app/a', ['ghmetric.vercel.app'])).toBe(true);
    expect(hostMatches(OTHER_URL, ['ghmetric.vercel.app'])).toBe(false);
    expect(hostMatches('not a url', ['ghmetric.vercel.app'])).toBe(false);
  });

  test('collectCamoUrls keeps only URLs pointing at the allowed hosts', async () => {
    const html = `
      <img src="${camoUrl(OUR_URL)}">
      <img src="${camoUrl(OTHER_URL)}">
    `;
    const urls = await collectCamoUrls('https://github.com/vsmutok', ['ghmetric.vercel.app'], {
      fetchImpl: jest.fn().mockResolvedValue(textResponse(html)),
    });
    expect(urls).toEqual([camoUrl(OUR_URL)]);
  });

  test('warmCamoCache requests each matching camo URL', async () => {
    const html = `<img src="${camoUrl(OUR_URL)}">`;
    const fetchImpl = jest.fn((url) => {
      if (url.startsWith('https://github.com/')) {
        return Promise.resolve(textResponse(html));
      }
      return Promise.resolve(textResponse('', { url }));
    });

    const summary = await warmCamoCache({
      pages: ['https://github.com/vsmutok'],
      hosts: ['ghmetric.vercel.app'],
      fetchImpl,
    });

    expect(summary.warmed).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.pages['https://github.com/vsmutok']).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(camoUrl(OUR_URL), expect.anything());
  });

  test('warmCamoCache records page load failures without throwing', async () => {
    const summary = await warmCamoCache({
      pages: ['https://github.com/vsmutok'],
      hosts: ['ghmetric.vercel.app'],
      fetchImpl: jest.fn().mockResolvedValue(textResponse('', { status: 500 })),
    });

    expect(summary.warmed).toBe(0);
    expect(summary.errors).toHaveLength(1);
  });
});
