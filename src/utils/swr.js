// Stale-while-revalidate helper.
//
// Serves a cached value immediately — even if it is past its TTL — and refreshes
// it in the background, so a request never waits for a cold GitHub fetch once a
// value has ever been cached. Concurrent refreshes for the same key are
// deduplicated.

import { githubCache } from './cache.js';

const inflight = new Map();

function refresh(key, fetchValue, isCacheable) {
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = Promise.resolve()
    .then(fetchValue)
    .then((value) => {
      if (value !== undefined && (!isCacheable || isCacheable(value))) {
        githubCache.set(key, value);
      }
      return value;
    })
    .catch(() => undefined)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * @param {string} key          cache key
 * @param {() => Promise<any>} fetchValue  fetch + build the value to cache
 * @param {(value:any)=>boolean} [isCacheable]  only cache when true (e.g. success)
 */
export async function withSwr(key, fetchValue, isCacheable) {
  const meta = githubCache.getWithMeta(key);

  if (meta && meta.fresh) {
    return meta.value;
  }

  if (meta) {
    // Fresh enough to serve, stale enough to refresh in the background.
    // We don't await the refresh — the next request will re-trigger it if this
    // one is cut short by the serverless runtime.
    void refresh(key, fetchValue, isCacheable);
    return meta.value;
  }

  // Nothing cached yet — fetch now (deduped with any concurrent cold request).
  return refresh(key, fetchValue, isCacheable);
}
