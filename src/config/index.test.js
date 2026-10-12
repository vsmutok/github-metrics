import { describe, expect, test } from '@jest/globals';
import { loadConfig, validateConfig } from './index.js';

describe('config', () => {
  test('loads defaults for optional runtime settings', () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      env: 'development',
      isProduction: false,
      port: 3000,
      github: {
        token: null,
        enabled: false,
      },
      admin: {
        apiKey: null,
        cacheStatsProtected: false,
      },
      analytics: {
        disabled: false,
        enabled: false,
        mongoUri: null,
      },
      cache: {
        maxSize: 1000,
        defaultTtlMs: 300000,
      },
      oauth: {
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        enabled: false,
      },
      security: {
        tokenEncryptionKey: null,
      },
      defaults: {
        username: 'vsmutok',
      },
    });
    expect(config.diagnostics.missingOptional).toEqual([
      'GITHUB_TOKEN',
      'MONGODB_URI',
      'ADMIN_API_KEY',
      'GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, GITHUB_OAUTH_REDIRECT_URI',
      'TOKEN_ENCRYPTION_KEY',
    ]);
  });

  test('enables optional features from environment values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      GITHUB_TOKEN: 'ghp_test',
      ADMIN_API_KEY: 'secret',
      MONGODB_URI: 'mongodb://localhost:27017/github-metrics',
      MONGODB_DB: 'github_metrics_test',
      CACHE_MAX_SIZE: '42',
      DEFAULT_USERNAME: 'vsmutok',
      GITHUB_OAUTH_CLIENT_ID: 'client-id',
      GITHUB_OAUTH_CLIENT_SECRET: 'client-secret',
      GITHUB_OAUTH_REDIRECT_URI: 'https://example.test/api/auth/callback',
      TOKEN_ENCRYPTION_KEY: 'encryption-key',
    });

    expect(config).toMatchObject({
      env: 'production',
      isProduction: true,
      port: 8080,
      github: {
        token: 'ghp_test',
        enabled: true,
      },
      admin: {
        apiKey: 'secret',
        cacheStatsProtected: true,
      },
      analytics: {
        disabled: false,
        enabled: true,
        mongoUri: 'mongodb://localhost:27017/github-metrics',
        dbName: 'github_metrics_test',
      },
      cache: {
        maxSize: 42,
        defaultTtlMs: 1800000,
      },
      oauth: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://example.test/api/auth/callback',
        enabled: true,
      },
      security: {
        tokenEncryptionKey: 'encryption-key',
      },
      defaults: {
        username: 'vsmutok',
      },
    });
    expect(config.diagnostics.missingOptional).toEqual([]);
    expect(config.diagnostics.features).toMatchObject({
      oauth: true,
      tokenEncryption: true,
      privateAccess: true,
    });
  });

  test('reports invalid ports as startup errors', () => {
    const config = loadConfig({ PORT: 'not-a-port' });

    expect(config.port).toBe(3000);
    expect(config.diagnostics.errors).toEqual([
      'PORT must be an integer between 1 and 65535. Received: not-a-port',
    ]);
    expect(() => validateConfig(config)).toThrow('Invalid configuration');
  });

  test('warns and falls back for invalid cache sizes', () => {
    const config = loadConfig({ CACHE_MAX_SIZE: '0' });

    expect(config.cache.maxSize).toBe(1000);
    expect(config.diagnostics.warnings).toContain('CACHE_MAX_SIZE is invalid; using default 1000.');
  });

  test('keeps analytics disabled when explicitly requested', () => {
    const config = loadConfig({
      DISABLE_ANALYTICS: 'yes',
      MONGODB_URI: 'mongodb://localhost:27017/github-metrics',
    });

    expect(config.analytics.disabled).toBe(true);
    expect(config.analytics.enabled).toBe(false);
    expect(config.diagnostics.features.analytics).toBe(false);
    expect(config.diagnostics.missingOptional).not.toContain('MONGODB_URI');
  });
});
