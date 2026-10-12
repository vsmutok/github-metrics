import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';

let oauth;

beforeAll(async () => {
  process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client-id';
  process.env.GITHUB_OAUTH_CLIENT_SECRET = 'test-client-secret';
  process.env.GITHUB_OAUTH_REDIRECT_URI = 'https://example.test/api/auth/callback';
  jest.resetModules();
  oauth = await import('../github-oauth.service.js');
});

function jsonResponse(data, init = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    url: init.url || 'https://api.github.com/mock',
    headers: init.headers || { get: () => null },
    json: async () => data,
    text: async () => JSON.stringify(data),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

afterEach(() => {
  delete globalThis.fetch;
});

describe('github-oauth.service.js', () => {
  test('is enabled when all OAuth env vars are present', () => {
    expect(oauth.isOAuthEnabled()).toBe(true);
  });

  test('builds an authorize URL with client id, scope and a signed state', () => {
    const url = new URL(oauth.buildAuthorizeUrl('user-key-1234567890'));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('scope')).toContain('repo');
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.test/api/auth/callback');
    expect(url.searchParams.get('state')).toContain('.');
  });

  test('round-trips a signed state back to the user_key', () => {
    const state = new URL(oauth.buildAuthorizeUrl('abc-123-xyz')).searchParams.get('state');
    expect(oauth.verifyState(state)).toBe('abc-123-xyz');
  });

  test('rejects a tampered state', () => {
    const state = new URL(oauth.buildAuthorizeUrl('abc-123-xyz')).searchParams.get('state');
    const [payload, signature] = state.split('.');
    const tampered = `${payload}.${signature.slice(0, -1)}A`;
    expect(oauth.verifyState(tampered)).toBeNull();
    expect(oauth.verifyState('not-a-state')).toBeNull();
    expect(oauth.verifyState('')).toBeNull();
  });

  test('exchanges a code for an access token', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce(
      jsonResponse({ access_token: 'gho_exchanged', scope: 'read:user repo' }),
    );

    const result = await oauth.exchangeCodeForToken('the-code');
    expect(result.accessToken).toBe('gho_exchanged');
    expect(result.scope).toBe('read:user repo');
  });

  test('throws when the token response has no access_token', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce(
      jsonResponse({ error: 'bad_verification_code' }),
    );

    await expect(oauth.exchangeCodeForToken('bad-code')).rejects.toThrow(/bad_verification_code/);
  });

  test('resolves the authenticated user login', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce(
      jsonResponse({ login: 'octocat', name: 'The Octocat', avatar_url: 'https://a.test/x.png' }),
    );

    const user = await oauth.fetchAuthenticatedUser('gho_token');
    expect(user).toEqual({ login: 'octocat', name: 'The Octocat', avatarUrl: 'https://a.test/x.png' });
  });

  test('revokes a token via the applications API', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce(jsonResponse({}, { status: 204 }));
    globalThis.fetch = mockFetch;

    const ok = await oauth.revokeToken('gho_to_revoke');
    expect(ok).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/applications/test-client-id/token');
    expect(opts.method).toBe('DELETE');
  });
});
