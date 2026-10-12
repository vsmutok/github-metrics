// TTL-based in-memory cache with LRU eviction
import config from '../config/index.js';

const DEFAULT_CACHE_TTL = config.cache.defaultTtlMs;
const DEFAULT_MAX_SIZE = config.cache.maxSize;
const DEFAULT_STALE_TTL = config.cache.staleTtlMs;

class Cache {
  constructor(defaultTTL = DEFAULT_CACHE_TTL, maxSize = DEFAULT_MAX_SIZE, defaultStaleTtl = DEFAULT_STALE_TTL) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
    this.defaultStaleTtl = defaultStaleTtl;
    this.store = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get a value from cache
   * Returns null if not found or expired
   */
  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Stale-aware read used by stale-while-revalidate.
   * Returns { value, fresh } (fresh=false means past its TTL but still within
   * the stale window) or null once it is past the stale window.
   */
  getWithMeta(key) {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.staleUntil) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    this.stats.hits++;
    return { value: entry.value, fresh: now <= entry.expiresAt };
  }

  /**
   * Set a value in cache with optional TTL. Expired values are kept for an
   * extra `staleTtl` so they can be served immediately while revalidated.
   */
  set(key, value, ttl = this.defaultTTL, staleTtl = this.defaultStaleTtl) {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttl,
      staleUntil: now + ttl + staleTtl,
    });
  }

  /**
   * Check if key exists and is not expired
   * Pure membership check, does not modify statistics or LRU order
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from cache
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear() {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get cache size
   */
  size() {
    return this.store.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return { ...this.stats, size: this.store.size };
  }
}

// Singleton instance for GitHub data cache
export const githubCache = new Cache();

export default Cache;
