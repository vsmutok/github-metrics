// GitHub OAuth App flow: build the authorize URL, exchange the code for an
// access token, resolve the authenticated user and revoke tokens on logout.

import crypto from 'node:crypto';
import config from '../config/index.js';
import { httpRequest } from '../utils/http-client.js';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_USER_AGENT = 'github-metrics';

// `repo` is required to read private repositories; `read:user` grants the
// private contribution counts on the profile. GitHub classic OAuth has no
// read-only private-repo scope, so this is the narrowest set that works.
export const OAUTH_SCOPES = Object.freeze(['read:user', 'repo']);

function stateSecret() {
  return config.security?.tokenEncryptionKey || config.oauth?.clientSecret || 'github-metrics-oauth';
}

function base64url(input) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function signState(userKey) {
  const payload = base64url(userKey);
  const signature = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Verify a signed OAuth `state` and return the embedded user_key, or null when
 * the signature is missing/invalid (CSRF protection).
 */
export function verifyState(state) {
  if (typeof state !== 'string' || !state.includes('.')) {
    return null;
  }
  const [payload, signature] = state.split('.');
  if (!payload || !signature) {
    return null;
  }
  const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    return Buffer.from(payload, 'base64url').toString('utf8');
  } catch (error) {
    return null;
  }
}

/** Whether the OAuth flow is configured and can be used. */
export function isOAuthEnabled() {
  return Boolean(config.oauth?.enabled);
}

/** Build the GitHub authorization URL the studio redirects the user to. */
export function buildAuthorizeUrl(userKey, { scopes = OAUTH_SCOPES } = {}) {
  const params = new URLSearchParams({
    client_id: config.oauth.clientId,
    redirect_uri: config.oauth.redirectUri,
    scope: scopes.join(' '),
    state: signState(userKey),
    allow_signup: 'true',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange an OAuth `code` for an access token.
 * @returns {Promise<{ accessToken: string, scope: string }>}
 */
export async function exchangeCodeForToken(code) {
  const response = await httpRequest(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': GITHUB_USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: config.oauth.clientId,
      client_secret: config.oauth.clientSecret,
      code,
      redirect_uri: config.oauth.redirectUri,
    }).toString(),
  });

  if (!response.success) {
    throw new Error(`OAuth token exchange failed (HTTP ${response.status || 0})`);
  }

  const accessToken = response.data?.access_token;
  if (!accessToken) {
    const detail = response.data?.error_description || response.data?.error || 'access_token missing';
    throw new Error(`OAuth token exchange failed: ${detail}`);
  }

  return {
    accessToken,
    scope: response.data?.scope || '',
  };
}

/**
 * Resolve the login of the user that owns an access token.
 * @returns {Promise<{ login: string, name: string, avatarUrl: string }>}
 */
export async function fetchAuthenticatedUser(accessToken) {
  const response = await httpRequest(`${GITHUB_API_BASE}/user`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': GITHUB_USER_AGENT,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.success) {
    throw new Error(`Failed to resolve OAuth user (HTTP ${response.status || 0})`);
  }

  const login = response.data?.login;
  if (!login) {
    throw new Error('OAuth user response did not include a login');
  }

  return {
    login,
    name: response.data?.name || login,
    avatarUrl: response.data?.avatar_url || '',
  };
}

/** Revoke an app authorization so the token can no longer be used. */
export async function revokeToken(accessToken) {
  if (!accessToken || !config.oauth?.enabled) {
    return false;
  }

  const credentials = Buffer.from(`${config.oauth.clientId}:${config.oauth.clientSecret}`).toString('base64');
  const response = await httpRequest(`${GITHUB_API_BASE}/applications/${config.oauth.clientId}/token`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT,
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({ access_token: accessToken }),
  });

  return response.success;
}
