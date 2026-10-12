import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('mongoose', () => ({
  default: {
    Schema: class Schema {
      constructor(definition, options) {
        this.definition = definition;
        this.options = options;
      }
    },
    connection: { readyState: 0 },
    connect: jest.fn(),
    models: {},
    model: jest.fn(() => class OAuthToken {}),
  },
}));

const KEY = 'unit-test-encryption-key';
let store;

beforeAll(async () => {
  store = await import('../token-store.service.js');
});

describe('token-store.service.js — encryption', () => {
  test('encrypts and decrypts a token with a round trip', () => {
    const encrypted = store.encryptToken('gho_secret_token', KEY);
    expect(encrypted).not.toBe('gho_secret_token');
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(store.decryptToken(encrypted, KEY)).toBe('gho_secret_token');
  });

  test('passes plain values through unchanged', () => {
    expect(store.decryptToken('plain-token', KEY)).toBe('plain-token');
  });

  test('produces a different ciphertext each time (random IV)', () => {
    expect(store.encryptToken('same', KEY)).not.toBe(store.encryptToken('same', KEY));
  });

  test('returns null when the ciphertext is tampered with', () => {
    const [, iv, tag, data] = store.encryptToken('tamper-me', KEY).split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 0xff;
    expect(store.decryptToken(`v1:${iv}:${tag}:${flipped.toString('base64')}`, KEY)).toBeNull();
  });

  test('returns null when the wrong key is used', () => {
    const encrypted = store.encryptToken('secret', KEY);
    expect(store.decryptToken(encrypted, 'a-different-key')).toBeNull();
  });
});

describe('token-store.service.js — storage', () => {
  beforeEach(() => {
    store.clearMemoryStore();
  });

  test('reports storage capabilities', () => {
    expect(typeof store.isPersistentStore()).toBe('boolean');
    expect(typeof store.isEncryptionEnabled()).toBe('boolean');
  });

  test('saves and retrieves a token by user_key', async () => {
    await store.saveToken({
      userKey: 'a'.repeat(32),
      userId: 'octocat',
      accessToken: 'gho_abc',
      scope: 'repo',
      privateAccess: true,
    });

    const record = await store.getTokenByKey('a'.repeat(32));
    expect(record).toMatchObject({
      userId: 'octocat',
      accessToken: 'gho_abc',
      privateAccess: true,
    });
  });

  test('returns null for an unknown user_key', async () => {
    expect(await store.getTokenByKey('unknown-key-000000000000')).toBeNull();
    expect(await store.getTokenByKey('')).toBeNull();
  });

  test('finds a token by GitHub login', async () => {
    await store.saveToken({ userKey: 'b'.repeat(32), userId: 'torvalds', accessToken: 'gho_xyz' });
    const record = await store.getTokenByUser('torvalds');
    expect(record?.accessToken).toBe('gho_xyz');
  });

  test('deletes a token by user_key', async () => {
    const key = 'c'.repeat(32);
    await store.saveToken({ userKey: key, userId: 'octocat', accessToken: 'gho_delete' });
    await store.deleteTokenByKey(key);
    expect(await store.getTokenByKey(key)).toBeNull();
  });
});
