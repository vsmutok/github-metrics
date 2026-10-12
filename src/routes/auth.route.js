import { Router } from 'express';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchAuthenticatedUser,
  isOAuthEnabled,
  revokeToken,
  verifyState,
} from '../services/github-oauth.service.js';
import {
  deleteTokenByKey,
  getTokenByKey,
  isEncryptionEnabled,
  isPersistentStore,
  saveToken,
} from '../services/token-store.service.js';

const router = Router();

const USER_KEY_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

function normalizeUserKey(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return USER_KEY_REGEX.test(raw) ? raw : null;
}

/** Public origin of the studio, derived from the configured callback URL. */
function studioOrigin() {
  const configured = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch (error) { /* fall through */ }
  }
  return '';
}

function redirectWithStatus(res, status, extra = '') {
  const origin = studioOrigin();
  const target = origin ? `${origin}/` : '/';
  res.redirect(302, `${target}?auth=${encodeURIComponent(status)}${extra}`);
}

/**
 * GET /api/auth/status
 * Reports whether private access is available on this deployment.
 */
router.get('/status', (_req, res) => {
  res.json({
    enabled: isOAuthEnabled(),
    persistent: isPersistentStore(),
    encrypted: isEncryptionEnabled(),
  });
});

/**
 * GET /api/auth/login?user_key=...
 * Starts the GitHub OAuth flow for the given browser-held user_key.
 */
router.get('/login', (req, res) => {
  if (!isOAuthEnabled()) {
    return res.status(503).json({ error: 'GitHub OAuth is not configured on this deployment' });
  }

  const userKey = normalizeUserKey(req.query.user_key);
  if (!userKey) {
    return res.status(400).json({ error: 'A valid user_key is required' });
  }

  res.redirect(302, buildAuthorizeUrl(userKey));
});

/**
 * GET /api/auth/callback
 * GitHub redirects here after the user authorizes the app. Exchanges the code,
 * stores the token against the user_key and returns to the studio.
 */
router.get('/callback', async (req, res) => {
  const userKey = verifyState(req.query.state);
  const code = typeof req.query.code === 'string' ? req.query.code : '';

  if (!isOAuthEnabled()) {
    return redirectWithStatus(res, 'error', '&reason=not_configured');
  }
  if (!userKey || !normalizeUserKey(userKey)) {
    return redirectWithStatus(res, 'error', '&reason=invalid_state');
  }
  if (!code) {
    return redirectWithStatus(res, 'error', '&reason=missing_code');
  }

  try {
    const { accessToken, scope } = await exchangeCodeForToken(code);
    const user = await fetchAuthenticatedUser(accessToken);

    await saveToken({
      userKey,
      userId: user.login,
      accessToken,
      scope,
      privateAccess: true,
    });

    return redirectWithStatus(res, 'success', `&login=${encodeURIComponent(user.login)}`);
  } catch (error) {
    console.error('OAuth callback failed:', error?.message || error);
    return redirectWithStatus(res, 'error', '&reason=exchange_failed');
  }
});

/**
 * GET /api/auth/session?user_key=...
 * Returns the (token-free) session state for a user_key.
 */
router.get('/session', async (req, res) => {
  const userKey = normalizeUserKey(req.query.user_key);
  if (!userKey) {
    return res.json({ enabled: isOAuthEnabled(), authenticated: false });
  }

  const token = await getTokenByKey(userKey);
  res.json({
    enabled: isOAuthEnabled(),
    authenticated: Boolean(token),
    login: token?.userId || null,
    privateAccess: Boolean(token?.privateAccess),
  });
});

/**
 * POST /api/auth/logout?user_key=...
 * Revokes the GitHub authorization and removes the stored token.
 */
router.post('/logout', async (req, res) => {
  const userKey = normalizeUserKey(req.query.user_key);
  if (!userKey) {
    return res.status(400).json({ error: 'A valid user_key is required' });
  }

  const token = await getTokenByKey(userKey);
  if (token) {
    try {
      await revokeToken(token.accessToken);
    } catch (error) {
      console.error('OAuth revoke failed:', error?.message || error);
    }
  }
  await deleteTokenByKey(userKey);
  res.json({ ok: true });
});

export default router;
