// Persistent store for GitHub OAuth access tokens.
//
// Tokens are kept server-side and referenced from card URLs by an opaque
// `user_key` (a random string the studio keeps in the browser). The token
// itself is never exposed to the client. When MONGODB_URI is configured the
// tokens live in MongoDB; otherwise an in-memory fallback keeps local
// development working (but does not survive a restart / serverless cold start).

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import config from '../config/index.js';

const ENCRYPTED_PREFIX = 'v1:';
const MEMORY_MAX_ENTRIES = 1000;

/* in-memory fallback: userKey -> { userId, accessToken, scope, privateAccess } */
const memoryStore = new Map();
let model = null;
let connecting = null;

function encryptionKey(override) {
  return override || config.security?.tokenEncryptionKey || null;
}

function deriveKey(secret) {
  // 32-byte key for AES-256.
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypt a token with AES-256-GCM. Returns the input unchanged when no
 * encryption key is configured (with a startup warning logged elsewhere).
 */
export function encryptToken(token, keyOverride) {
  const key = encryptionKey(keyOverride);
  if (!token || !key) {
    return token;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt a value produced by encryptToken. Plain values (no prefix) are
 * returned as-is for backwards compatibility.
 */
export function decryptToken(payload, keyOverride) {
  if (typeof payload !== 'string' || !payload.startsWith(ENCRYPTED_PREFIX)) {
    return payload;
  }

  const key = encryptionKey(keyOverride);
  if (!key) {
    return null;
  }

  const [, ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(key), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (error) {
    return null;
  }
}

function mongoUri() {
  return config.analytics?.mongoUri || null;
}

function getModel() {
  if (model) {
    return model;
  }
  const schema = new mongoose.Schema({
    userKey: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    accessToken: { type: String, required: true },
    scope: { type: String, default: '' },
    privateAccess: { type: Boolean, default: false },
  }, {
    collection: 'oauth_tokens',
    timestamps: true,
  });
  model = mongoose.models.OAuthToken || mongoose.model('OAuthToken', schema);
  return model;
}

async function ensureConnection() {
  if (!mongoUri()) {
    return false;
  }
  // readyState 1 === connected
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  if (connecting) {
    return connecting;
  }
  connecting = mongoose.connect(mongoUri(), {
    dbName: config.analytics?.dbName,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 10000,
  }).then(() => true).catch(() => false).finally(() => {
    connecting = null;
  });
  return connecting;
}

/** Whether tokens are persisted across restarts (MongoDB reachable/config'd). */
export function isPersistentStore() {
  return Boolean(mongoUri());
}

/** Whether stored tokens are encrypted at rest. */
export function isEncryptionEnabled() {
  return Boolean(encryptionKey());
}

function setMemory(record) {
  if (memoryStore.size >= MEMORY_MAX_ENTRIES && !memoryStore.has(record.userKey)) {
    const oldest = memoryStore.keys().next().value;
    if (oldest !== undefined) {
      memoryStore.delete(oldest);
    }
  }
  memoryStore.set(record.userKey, record);
}

/**
 * Store (or replace) the token associated with a user_key.
 * @returns {Promise<boolean>} true when persisted durably, false when only
 * cached in memory.
 */
export async function saveToken({ userKey, userId, accessToken, scope = '', privateAccess = false }) {
  const record = {
    userKey,
    userId,
    accessToken: encryptToken(accessToken),
    scope,
    privateAccess: Boolean(privateAccess),
  };

  if (await ensureConnection()) {
    try {
      await getModel().updateOne({ userKey }, { $set: record }, { upsert: true });
      return true;
    } catch (error) {
      console.error('Failed to persist OAuth token:', error?.message || error);
    }
  }

  setMemory({ ...record, accessToken: record.accessToken });
  return false;
}

/**
 * Look up a token by user_key.
 * @returns {Promise<{ userId: string, accessToken: string, scope: string, privateAccess: boolean } | null>}
 */
export async function getTokenByKey(userKey) {
  if (!userKey) {
    return null;
  }

  if (await ensureConnection()) {
    try {
      const doc = await getModel().findOne({ userKey }).lean();
      if (doc) {
        const accessToken = decryptToken(doc.accessToken);
        return accessToken ? {
          userId: doc.userId,
          accessToken,
          scope: doc.scope || '',
          privateAccess: Boolean(doc.privateAccess),
        } : null;
      }
    } catch (error) {
      console.error('Failed to read OAuth token:', error?.message || error);
    }
  }

  const record = memoryStore.get(userKey);
  if (!record) {
    return null;
  }
  const accessToken = decryptToken(record.accessToken);
  return accessToken ? { ...record, accessToken } : null;
}

/** Look up a token by GitHub login (used to revoke on logout). */
export async function getTokenByUser(userId) {
  if (!userId) {
    return null;
  }

  if (await ensureConnection()) {
    try {
      const doc = await getModel().findOne({ userId }).lean();
      if (doc) {
        const accessToken = decryptToken(doc.accessToken);
        return accessToken ? {
          userKey: doc.userKey,
          userId: doc.userId,
          accessToken,
          scope: doc.scope || '',
          privateAccess: Boolean(doc.privateAccess),
        } : null;
      }
    } catch (error) {
      console.error('Failed to read OAuth token by user:', error?.message || error);
    }
  }

  for (const record of memoryStore.values()) {
    if (record.userId === userId) {
      const accessToken = decryptToken(record.accessToken);
      return accessToken ? { ...record, accessToken } : null;
    }
  }
  return null;
}

/** Remove the token associated with a user_key. */
export async function deleteTokenByKey(userKey) {
  if (!userKey) {
    return;
  }
  memoryStore.delete(userKey);
  if (await ensureConnection()) {
    try {
      await getModel().deleteOne({ userKey });
    } catch (error) {
      console.error('Failed to delete OAuth token:', error?.message || error);
    }
  }
}

/** Remove every token belonging to a GitHub login. */
export async function deleteTokenByUser(userId) {
  if (!userId) {
    return;
  }
  for (const [key, record] of memoryStore.entries()) {
    if (record.userId === userId) {
      memoryStore.delete(key);
    }
  }
  if (await ensureConnection()) {
    try {
      await getModel().deleteMany({ userId });
    } catch (error) {
      console.error('Failed to delete OAuth tokens by user:', error?.message || error);
    }
  }
}

/** Test helper — wipe the in-memory fallback store. */
export function clearMemoryStore() {
  memoryStore.clear();
}
