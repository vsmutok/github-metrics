import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTheme, wrapSvg, SUPPORTED_THEME_NAMES } from '../src/renderers/svg.renderer.js';
import { renderDashboard, buildDemoModel } from '../src/renderers/dashboard.renderer.js';
import { DEMO_PROFILE } from '../src/data/demo-profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREVIEW_DIR = path.join(__dirname, '..', 'previews');
const PUBLIC_PREVIEW_DIR = path.join(__dirname, '..', 'public', 'previews');

[PREVIEW_DIR, PUBLIC_PREVIEW_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

function buildSvg(themeName) {
  setTheme(themeName);
  const model = buildDemoModel(DEMO_PROFILE, { align: 'left', formatNumber });
  const { content, width, height } = renderDashboard(model);
  return wrapSvg(content, width, height);
}

console.log('Generating theme previews...');

SUPPORTED_THEME_NAMES.forEach((themeName) => {
  const svg = buildSvg(themeName);

  fs.writeFileSync(path.join(PREVIEW_DIR, `${themeName}.svg`), svg);
  fs.writeFileSync(path.join(PUBLIC_PREVIEW_DIR, `${themeName}.svg`), svg);
  console.log(`Generated: ${themeName}.svg`);
});

console.log(`\nAll previews generated in ${PREVIEW_DIR} and ${PUBLIC_PREVIEW_DIR}`);
