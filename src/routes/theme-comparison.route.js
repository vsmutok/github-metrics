import { Router } from 'express';
import { setTheme, wrapSvg } from '../renderers/svg.renderer.js';
import { renderDashboard, buildDemoModel } from '../renderers/dashboard.renderer.js';
import { DEMO_PROFILE } from '../data/demo-profile.js';

const router = Router();

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

// Render a full dashboard preview for a specific theme using the shared demo
// profile so every preview matches the studio output.
router.get('/:themeName', (req, res) => {
  try {
    const { themeName } = req.params;

    setTheme(themeName);

    const model = buildDemoModel(DEMO_PROFILE, {
      align: 'left',
      sections: {},
      formatNumber,
    });

    const { content, width, height } = renderDashboard(model);
    const svg = wrapSvg(content, width, height, {
      title: `${DEMO_PROFILE.name}'s Dashboard - ${themeName} Theme`,
      description: 'GitHub profile statistics dashboard preview',
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(svg);
  } catch (error) {
    console.error('Theme preview render failed:', error.message);
    res.status(500).json({ error: 'Error rendering theme preview' });
  }
});

export default router;
