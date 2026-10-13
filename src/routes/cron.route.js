import { Router } from 'express';
import config from '../config/index.js';
import { warmCamoCache } from '../services/camo-warm.service.js';

const router = Router();

/**
 * Nightly job that re-warms GitHub's camo cache for our README embeds.
 * Triggered by Vercel Cron; Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is configured.
 */
router.get('/', async (req, res) => {
  const { secret, warmPages, warmHosts } = config.cron;

  if (secret) {
    const authHeader = req.headers['authorization'] || '';
    const supplied = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (supplied !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const summary = await warmCamoCache({ pages: warmPages, hosts: warmHosts });
    console.info(
      `[cron] camo warm: ${summary.warmed} warmed, ${summary.failed} failed across ${warmPages.length} page(s)`
    );
    return res.json({ status: 'ok', ...summary });
  } catch (error) {
    console.error(`[cron] camo warm failed: ${error.message}`);
    return res.status(500).json({ status: 'error', error: error.message });
  }
});

export default router;
