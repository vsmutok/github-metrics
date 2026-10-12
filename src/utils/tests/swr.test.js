import { afterEach, describe, expect, test } from '@jest/globals';
import { githubCache } from '../cache.js';
import { withSwr } from '../swr.js';

const keys = [];
function uniqueKey(name) {
  const key = `test:swr:${name}:${keys.length}`;
  keys.push(key);
  return key;
}

afterEach(() => {
  keys.forEach((key) => githubCache.delete(key));
  keys.length = 0;
});

describe('withSwr', () => {
  test('fetches and caches on a cold miss', async () => {
    const key = uniqueKey('cold');
    let calls = 0;
    const value = await withSwr(key, async () => {
      calls += 1;
      return { v: 1 };
    });

    expect(value).toEqual({ v: 1 });
    expect(calls).toBe(1);
    expect(githubCache.getWithMeta(key)?.fresh).toBe(true);
  });

  test('serves a fresh cached value without calling the fetcher', async () => {
    const key = uniqueKey('fresh');
    githubCache.set(key, { v: 'cached' });

    let calls = 0;
    const value = await withSwr(key, async () => {
      calls += 1;
      return { v: 'fetched' };
    });

    expect(value).toEqual({ v: 'cached' });
    expect(calls).toBe(0);
  });

  test('serves a stale value immediately and refreshes in the background', async () => {
    const key = uniqueKey('stale');
    githubCache.set(key, { v: 'old' }, -1000, 60000); // stale but within window

    let calls = 0;
    const value = await withSwr(key, async () => {
      calls += 1;
      return { v: 'new' };
    });

    expect(value).toEqual({ v: 'old' }); // stale served instantly

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(1);
    expect(githubCache.getWithMeta(key)?.value).toEqual({ v: 'new' });
  });

  test('does not cache values rejected by isCacheable', async () => {
    const key = uniqueKey('nocache');
    const value = await withSwr(
      key,
      async () => ({ success: false }),
      (result) => result?.success === true
    );

    expect(value).toEqual({ success: false });
    expect(githubCache.getWithMeta(key)).toBeNull();
  });
});
