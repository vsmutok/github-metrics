// SVG Layout System
// src/renderers/svg.renderer.js

import darkTheme from '../themes/dark.theme.js';
import lightTheme from '../themes/light.theme.js';
import draculaTheme from '../themes/dracula.theme.js';
import nordTheme from '../themes/nord.theme.js';
import monokaiTheme from '../themes/monokai.theme.js';
import gruvboxTheme from '../themes/gruvbox.theme.js';
import tokyonightTheme from '../themes/tokyonight.theme.js';
import solarizedTheme from '../themes/solarized.theme.js';
import catppuccinTheme from '../themes/catppuccin.theme.js';
import rosePineTheme from '../themes/rose-pine.theme.js';
import auroraTheme from '../themes/aurora.theme.js';
import midnightSunsetTheme from '../themes/midnight-sunset.theme.js';
import oneDarkProTheme from '../themes/onedarkpro.theme.js';
import materialTheme from '../themes/material.theme.js';
import synthwave84Theme from '../themes/synthwave84.theme.js';
import forestNightTheme from '../themes/forestnight.theme.js';
import oceanicNextTheme from '../themes/oceanicnext.theme.js';
import emberGlowTheme from '../themes/emberglow.theme.js';
import midnightNeonTheme from '../themes/midnightneon.theme.js';
import pastelDreamTheme from '../themes/pasteldream.theme.js';
import androidstudioTheme from '../themes/androidstudio.theme.js';
import xcodeTheme from '../themes/xcode.theme.js';
import webdevTheme from '../themes/webdev.theme.js';
import aimlTheme from '../themes/aiml.theme.js';
import gamedevTheme from '../themes/gamedev.theme.js';
import cobalt2Theme from '../themes/cobalt2.theme.js';
import oneDarkTheme from '../themes/one-dark.theme.js';
import githubLightTheme from '../themes/github-light.theme.js';
import githubDarkTheme from '../themes/github-dark.theme.js';
import githubDimmedTheme from '../themes/github-dimmed.theme.js';
import hcLightTheme from '../themes/hc-light.theme.js';
import hcDarkTheme from '../themes/hc-dark.theme.js';
import { sanitizeSvgValue, sanitizeSvgHref } from '../utils/svg-sanitizer.js';
import { validateThemeAccessibility } from '../utils/theme-accessibility.js';

const LAYOUT = {
  width: 960,
  padding: 28,
  cardGap: 16,
  borderRadius: 16,
  cardRadius: 12,
};

// Available themes. GitHub's official palettes come first and `github-dark`
// is the project default.
const themes = {
  'github-dark': githubDarkTheme,
  'github-light': githubLightTheme,
  'github-dimmed': githubDimmedTheme,
  'hc-dark': hcDarkTheme,
  'hc-light': hcLightTheme,
  dark: darkTheme,
  light: lightTheme,
  dracula: draculaTheme,
  nord: nordTheme,
  monokai: monokaiTheme,
  gruvbox: gruvboxTheme,
  tokyonight: tokyonightTheme,
  solarized: solarizedTheme,
  catppuccin: catppuccinTheme,
  'rose-pine': rosePineTheme,
  aurora: auroraTheme,
  'midnight-sunset': midnightSunsetTheme,
  onedarkpro: oneDarkProTheme,
  material: materialTheme,
  synthwave84: synthwave84Theme,
  forestnight: forestNightTheme,
  oceanicnext: oceanicNextTheme,
  emberglow: emberGlowTheme,
  midnightneon: midnightNeonTheme,
  pasteldream: pastelDreamTheme,
  androidstudio: androidstudioTheme,
  xcode: xcodeTheme,
  webdev: webdevTheme,
  aiml: aimlTheme,
  gamedev: gamedevTheme,
  cobalt2: cobalt2Theme,
  'one-dark': oneDarkTheme,
};
Object.entries(themes).forEach(
  ([name, theme]) => {
    const result =
      validateThemeAccessibility(theme);

    if (
      !result.primaryPass ||
      !result.secondaryPass
    ) {
      console.warn(
        `[Accessibility] Theme "${name}" may have low contrast`,
        result
      );
    }
  }
);
export const SUPPORTED_THEME_NAMES = Object.freeze(Object.keys(themes));

// current active theme (GitHub Dark by default)
let currentTheme = githubDarkTheme;

// set active theme
const themeAliases = {
  'high-contrast': 'hc-light',
  'github': 'github-dark',
};

export function setTheme(themeInput) {
  if (themeInput && typeof themeInput === 'object' && themeInput.colors) {
    currentTheme = themeInput;
  } else {
    const resolved = themeAliases[themeInput] || themeInput;
    currentTheme = themes[resolved] || githubDarkTheme;
  }
  return currentTheme;
}

// get current theme
export function getTheme() {
  return currentTheme;
}

// generate SVG definitions (gradients, filters)
export function renderDefs() {
  const { colors } = currentTheme;
  const flat = currentTheme.flat === true;
  const ambientOpacity = flat ? 0 : 0.07;
  const accentFrom = flat ? colors.accent : colors.gradientStart;
  const accentTo = flat ? colors.accent : colors.gradientEnd;
  const glowOpacity = flat ? 0 : 0.16;

  return `
  <defs aria-hidden="true">
    <!-- ambient card gradient -->
    <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.gradientStart}" stop-opacity="${ambientOpacity}"/>
      <stop offset="100%" stop-color="${colors.gradientEnd}" stop-opacity="${ambientOpacity}"/>
    </linearGradient>

    <!-- accent gradient (solid for flat themes) -->
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentFrom}"/>
      <stop offset="100%" stop-color="${accentTo}"/>
    </linearGradient>

    <!-- vertical fill used by bars and medallions -->
    <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${accentFrom}"/>
      <stop offset="100%" stop-color="${accentTo}" stop-opacity="${flat ? 1 : 0.4}"/>
    </linearGradient>

    <!-- soft top glow behind the header -->
    <radialGradient id="headerGlow" cx="50%" cy="0%" r="75%">
      <stop offset="0%" stop-color="${colors.glow}" stop-opacity="${glowOpacity}"/>
      <stop offset="100%" stop-color="${colors.glow}" stop-opacity="0"/>
    </radialGradient>

    <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;
}

// render the main background
export function renderBackground(width, height) {
  const { colors } = currentTheme;
  const watermark = currentTheme.domainConfig?.watermark || '';

  return `
  <g aria-hidden="true">
  <!-- base background -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="${LAYOUT.borderRadius}" ry="${LAYOUT.borderRadius}" fill="${colors.background}"/>

  <!-- ambient wash -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="${LAYOUT.borderRadius}" ry="${LAYOUT.borderRadius}" fill="url(#mainGradient)"/>

  <!-- soft header glow -->
  <rect x="0" y="0" width="${width}" height="${Math.min(190, height)}" rx="${LAYOUT.borderRadius}" ry="${LAYOUT.borderRadius}" fill="url(#headerGlow)"/>

  <!-- hairline border -->
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${LAYOUT.borderRadius}" ry="${LAYOUT.borderRadius}" fill="none" stroke="${colors.border}" stroke-width="1" opacity="0.9"/>

  <!-- watermark -->
  ${watermark}
</g>`;
}

// render a card background frame with a left accent bar and title
// Shared helper to eliminate duplicated card frame markup across renderers.
export function renderCardFrame({ x, y, width, height, title, titleId, gradOpacity = 0.35, borderOpacity = 0.6, titleY = 27, centerTitle = false, titleComment = '<!-- title -->', accentComment = '<!-- title accent -->' }) {
  const { colors } = currentTheme;
  const safeTitle = sanitizeSvgValue(String(title).toUpperCase());
  const tId = titleId || `card-${String(title).toLowerCase().replace(/[^a-z0-9]/g, '-')}-${x}-${y}-title`;
  const titleX = centerTitle ? x + width / 2 : x + 28;
  const textAnchor = centerTitle ? ' text-anchor="middle"' : '';
  const accentX = centerTitle ? x + width / 2 - 16 : x + 18;
  const accentY = centerTitle ? y + titleY - 15 : y + titleY - 9;
  const accentW = centerTitle ? 32 : 3;
  const accentH = centerTitle ? 3 : 12;

  return [
    '<!-- card background -->',
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${LAYOUT.cardRadius}" ry="${LAYOUT.cardRadius}" fill="${colors.cardBackground}"/>`,
    '<!-- ambient wash -->',
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${LAYOUT.cardRadius}" ry="${LAYOUT.cardRadius}" fill="url(#mainGradient)" opacity="${gradOpacity}"/>`,
    '<!-- border -->',
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="${height - 1}" rx="${LAYOUT.cardRadius}" ry="${LAYOUT.cardRadius}" fill="none" stroke="${colors.border}" stroke-width="1" opacity="${borderOpacity}"/>`,
    accentComment,
    `<rect x="${accentX}" y="${accentY}" width="${accentW}" height="${accentH}" rx="${accentH / 2}" fill="url(#accentGradient)"/>`,
    titleComment,
    `<text id="${tId}" x="${titleX}" y="${y + titleY}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11.5" font-weight="700" fill="${colors.secondaryText}" letter-spacing="1.1"${textAnchor}>${safeTitle}</text>`,
  ].filter(Boolean);
}

// render a modern card container
export function renderCard({ x, y, width, height, title, glowColor }) {
  const { colors } = currentTheme;
  const cardId = `card-${String(title).toLowerCase().replace(/[^a-z0-9]/g, '-')}-${x}-${y}`;
  const cardDecorations = typeof currentTheme.domainConfig?.cardAccent === 'function'
    ? currentTheme.domainConfig.cardAccent(x, y, width, height, colors)
    : '';

  return `
  <g role="group" aria-labelledby="${cardId}-title">
    ${renderCardFrame({
      x, y, width, height, title,
      titleId: `${cardId}-title`,
      glowColor,
      glowOpacity: 0.03,
      gradOpacity: 0.5,
      borderOpacity: 0.5,
      titleY: 28,
      accentWidth: 32,
      accentY: 36,
      accentOpacity: 0.6,
      titleComment: '',
      accentComment: '<!-- title underline accent -->',
    }).join('\n    ')}

    <!-- domain card decorations -->
    ${cardDecorations}
  </g>`;
}

// render a stat item with a colored tick above the value
export function renderStatItem({ x, y, label, value, accentColor, showProgress, progress }) {
  const { colors } = currentTheme;
  const accent = accentColor || colors.accent;

  // dynamic font size based on value length
  const valueStr = String(value);
  const safeValue = sanitizeSvgValue(valueStr);
  const safeLabel = sanitizeSvgValue(String(label));
  let fontSize = 30;
  if (valueStr.length > 8) fontSize = 14;
  else if (valueStr.length > 6) fontSize = 18;
  else if (valueStr.length > 4) fontSize = 23;

  let progressBar = '';
  if (showProgress && progress !== undefined) {
    const barWidth = 60;
    const fillWidth = Math.min(barWidth, (progress / 100) * barWidth);
    progressBar = `
      <rect x="${x}" y="${y + 28}" width="${barWidth}" height="3" rx="1.5" fill="${colors.border}"/>
      <rect x="${x}" y="${y + 28}" width="${fillWidth}" height="3" rx="1.5" fill="${accent}"/>`;
  }

  const cleanLabel = String(label).toLowerCase().replace(/[^a-z0-9]/g, '');
  const valId = `val-${cleanLabel}-${x}-${y}`;
  const lblId = `lbl-${cleanLabel}-${x}-${y}`;

  return `
  <g role="group" aria-labelledby="${lblId} ${valId}">
    <rect x="${x}" y="${y - 38}" width="16" height="3" rx="1.5" fill="${accent}"/>
    <text id="${valId}" x="${x}" y="${y}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="${fontSize}" font-weight="800" fill="${colors.primaryText}" ${valueStr.length > 10 ? 'textLength="96" lengthAdjust="spacingAndGlyphs"' : ''}>${safeValue}</text>
    <text id="${lblId}" x="${x}" y="${y + 19}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="10.5" font-weight="500" fill="${colors.mutedText}" letter-spacing="0.6">${safeLabel}</text>
    ${progressBar}
  </g>`;
}

// renders vertical E/M/H stat
function renderVerticalEMH({ x, y, easy, medium, hard, accentColor }) {
  const { colors } = currentTheme;
  const safeEasy = sanitizeSvgValue(easy);
  const safeMedium = sanitizeSvgValue(medium);
  const safeHard = sanitizeSvgValue(hard);

  const easyColor = '#10b981';  // green
  const medColor = '#f59e0b';   // amber
  const hardColor = '#ef4444';  // red

  const lineHeight = 18;
  const labelWidth = 14;

  const easyValId = `val-easy-${x}-${y}`;
  const easyLblId = `lbl-easy-${x}-${y}`;
  const medValId = `val-med-${x}-${y}`;
  const medLblId = `lbl-med-${x}-${y}`;
  const hardValId = `val-hard-${x}-${y}`;
  const hardLblId = `lbl-hard-${x}-${y}`;

  return `
  <g role="group" aria-label="LeetCode Difficulty Breakdown">
    <!-- easy -->
    <g role="group" aria-labelledby="${easyLblId} ${easyValId}">
      <text id="${easyLblId}" x="${x}" y="${y - 18}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="${easyColor}">E</text>
      <text id="${easyValId}" x="${x + labelWidth}" y="${y - 18}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" font-weight="700" fill="${colors.primaryText}">${safeEasy}</text>
    </g>

    <!-- medium -->
    <g role="group" aria-labelledby="${medLblId} ${medValId}">
      <text id="${medLblId}" x="${x}" y="${y}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="${medColor}">M</text>
      <text id="${medValId}" x="${x + labelWidth}" y="${y}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" font-weight="700" fill="${colors.primaryText}">${safeMedium}</text>
    </g>
    <!-- hard -->
    <g role="group" aria-labelledby="${hardLblId} ${hardValId}">
      <text id="${hardLblId}" x="${x}" y="${y + 18}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="${hardColor}">H</text>
      <text id="${hardValId}" x="${x + labelWidth}" y="${y + 18}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" font-weight="700" fill="${colors.primaryText}">${safeHard}</text>
    </g>
  </g>`;
}

// renders a card with stats
export function renderCardWithStats({ x, y, width, height, title, stats, cardAccent }) {
  const { colors, chartColors } = currentTheme;
  const statsStartY = y + 85;
  const statSpacing = (width - 40) / stats.length;
  const cardId = `card-${String(title).toLowerCase().replace(/[^a-z0-9]/g, '-')}-${x}-${y}`;
  const cardDecorations = typeof currentTheme.domainConfig?.cardAccent === 'function'
    ? currentTheme.domainConfig.cardAccent(x, y, width, height, colors)
    : '';

  const statsContent = stats.map((stat, index) => {
    const statX = x + 20 + (index * statSpacing);
    const accent = chartColors[index % chartColors.length];

    // handle vertical E/M/H layout
    if (stat.isVertical) {
      return renderVerticalEMH({
        x: statX,
        y: statsStartY,
        easy: stat.easy,
        medium: stat.medium,
        hard: stat.hard,
        accentColor: accent,
      });
    }

    return renderStatItem({
      x: statX,
      y: statsStartY,
      label: stat.label,
      value: stat.value,
      accentColor: accent,
      showProgress: stat.showProgress,
      progress: stat.progress,
    });
  }).join('');

  return `
  <g role="group" aria-labelledby="${cardId}-title">
    ${renderCardFrame({
      x, y, width, height, title,
      titleId: `${cardId}-title`,
      gradOpacity: 0.35,
      borderOpacity: 0.6,
      titleY: 27,
      accentComment: '<!-- title accent -->',
    }).join('\n    ')}

    ${statsContent}

    <!-- domain card decorations -->
    ${cardDecorations}
  </g>`;
}

// render header section with branding
export function renderHeader({ x, y, title, subtitle, avatarUrl, align = 'left', handle = 'vsmutok' }) {
  const { colors } = currentTheme;
  const titleText = String(title ?? '');
  const safeTitle = sanitizeSvgValue(titleText);
  const safeSubtitle = subtitle ? sanitizeSvgValue(subtitle) : '';
  const safeAvatarUrl = sanitizeSvgHref(avatarUrl);
  const safeHandle = sanitizeSvgValue(String(handle || 'vsmutok'));

  // calculate positions based on alignment
  let avatarX, titleX, titleAnchor, subtitleAnchor;
  const avatarSize = 48;
  const avatarRadius = 24;
  const contentWidth = LAYOUT.width - (2 * LAYOUT.padding);

  if (align === 'center') {
    // center alignment
    const titleWidth = titleText.length * 13;
    const totalWidth = safeAvatarUrl ? avatarSize + 16 + titleWidth : titleWidth;
    const startX = x + (contentWidth - totalWidth) / 2;

    avatarX = startX;
    titleX = safeAvatarUrl ? startX + avatarSize + 16 : startX + totalWidth / 2;
    titleAnchor = safeAvatarUrl ? 'start' : 'middle';
    subtitleAnchor = safeAvatarUrl ? 'start' : 'middle';
  } else if (align === 'right') {
    // right alignment
    avatarX = x + contentWidth - avatarSize;
    titleX = safeAvatarUrl ? avatarX - 16 : x + contentWidth;
    titleAnchor = 'end';
    subtitleAnchor = 'end';
  } else {
    // left alignment
    avatarX = x;
    titleX = safeAvatarUrl ? x + avatarSize + 16 : x;
    titleAnchor = 'start';
    subtitleAnchor = 'start';
  }

  let avatarElement = '';
  if (safeAvatarUrl) {
    const avatarCenterX = avatarX + avatarRadius;
    const avatarCenterY = y - 8;
    avatarElement = `
      <clipPath id="avatarClip">
        <circle cx="${avatarCenterX}" cy="${avatarCenterY}" r="${avatarRadius}"/>
      </clipPath>
      <circle cx="${avatarCenterX}" cy="${avatarCenterY}" r="${avatarRadius + 3}" fill="${colors.cardBackground}" stroke="url(#accentGradient)" stroke-width="2"/>
      <image href="${safeAvatarUrl}" x="${avatarX}" y="${avatarCenterY - avatarRadius}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#avatarClip)"/>`;
  }

  const underlineWidth = 42;
  let underlineX = titleX;
  if (titleAnchor === 'middle') underlineX = titleX - underlineWidth / 2;
  else if (titleAnchor === 'end') underlineX = titleX - underlineWidth;

  // branding position: left when align=right, right otherwise
  const brandingX = align === 'right' ? LAYOUT.padding : LAYOUT.width - LAYOUT.padding;
  const brandingAnchor = align === 'right' ? 'start' : 'end';

  const headerDecorations = typeof currentTheme.domainConfig?.headerAccent === 'function'
    ? currentTheme.domainConfig.headerAccent(titleX, y, contentWidth, align, colors, Boolean(safeSubtitle))
    : '';

  return `
  <g>
    ${avatarElement}
    <!-- name -->
    <text x="${titleX}" y="${y}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="25" font-weight="700" fill="${colors.primaryText}" text-anchor="${titleAnchor}">${safeTitle}</text>
    <!-- accent underline -->
    <rect x="${underlineX}" y="${y + 9}" width="${underlineWidth}" height="3" rx="1.5" fill="url(#accentGradient)"/>
    ${safeSubtitle ? `<text x="${titleX}" y="${y + 26}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12.5" fill="${colors.mutedText}" text-anchor="${subtitleAnchor}">${safeSubtitle}</text>` : ''}

    <!-- branding -->
    <text x="${brandingX}" y="${y}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="500" fill="${colors.mutedText}" letter-spacing="0.2" text-anchor="${brandingAnchor}" opacity="0.6">${safeHandle}/github-metrics</text>

    <!-- domain header decorations -->
    ${headerDecorations}
  </g>`;
}

// calculate card width for a row with n cards
export function calculateCardWidth(numCards) {
  const availableWidth = LAYOUT.width - (LAYOUT.padding * 2);
  const totalGaps = (numCards - 1) * LAYOUT.cardGap;
  return (availableWidth - totalGaps) / numCards;
}

// calculate card x position for index in row
export function calculateCardX(index, cardWidth) {
  return LAYOUT.padding + (index * (cardWidth + LAYOUT.cardGap));
}

/**
 * get trophy tier based on value and thresholds
 * it returns { tier, color, glowIntensity }
 */
function getTrophyTier(value, thresholds) {
  const { colors } = currentTheme;

  // tier thresholds: S(legendary), A(epic), B(rare), C(uncommon), D(common)
  if (value >= thresholds.s) return { tier: 'S', color: '#ffd700', glowIntensity: 0.8, label: 'Legendary' };
  if (value >= thresholds.a) return { tier: 'A', color: '#a855f7', glowIntensity: 0.6, label: 'Epic' };
  if (value >= thresholds.b) return { tier: 'B', color: '#3b82f6', glowIntensity: 0.4, label: 'Rare' };
  if (value >= thresholds.c) return { tier: 'C', color: '#10b981', glowIntensity: 0.25, label: 'Uncommon' };
  return { tier: 'D', color: '#64748b', glowIntensity: 0.1, label: 'Common' };
}

// Shrink long trophy labels so they fit under a badge without overlapping
// their neighbours (domain themes use names like "Material Designer").
function trophyLabelFontSize(label) {
  const length = String(label).length;
  if (length <= 11) return 10;
  return Math.max(7, Math.round((82 / (length * 0.58)) * 10) / 10);
}

// modern style: circular medallion
function renderTrophyMedallion({ x, y, size, tier, icon, label, value }) {
  const { colors } = currentTheme;
  const halfSize = size / 2;
  const cx = x + halfSize;
  const cy = y + halfSize;
  const r = halfSize - 1;
  const safeTier = sanitizeSvgValue(tier.tier);
  const safeLabel = sanitizeSvgValue(label);
  const safeValue = sanitizeSvgValue(value);

  return `
  <g>
    <!-- glow -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${tier.color}" opacity="${tier.glowIntensity * 0.25}" filter="url(#softGlow)"/>

    <!-- medallion -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors.cardBackground}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#mainGradient)" opacity="0.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="${tier.color}" opacity="0.12"/>

    <!-- ring -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${tier.color}" stroke-width="2" opacity="0.85"/>

    <!-- icon -->
    <g transform="translate(${cx - 12}, ${cy - 12})" fill="none" stroke="${tier.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${icon}
    </g>

    <!-- tier chip -->
    <circle cx="${cx + r - 7}" cy="${cy - r + 7}" r="9" fill="${tier.color}" stroke="${colors.background}" stroke-width="2"/>
    <text x="${cx + r - 7}" y="${cy - r + 11}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9.5" font-weight="800" fill="${colors.background}" text-anchor="middle">${safeTier}</text>

    <!-- label -->
    <text x="${cx}" y="${y + size + 17}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="${trophyLabelFontSize(label)}" font-weight="600" fill="${colors.secondaryText}" text-anchor="middle">${safeLabel}</text>

    <!-- value -->
    <text x="${cx}" y="${y + size + 32}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13" font-weight="800" fill="${colors.primaryText}" text-anchor="middle">${safeValue}</text>
  </g>`;
}

// grid style: rounded tile
function renderTrophyTile({ x, y, size, tier, icon, label, value }) {
  const { colors } = currentTheme;
  const half = size / 2;
  const cx = x + half;
  const cy = y + half;
  const r = 14;
  const safeTier = sanitizeSvgValue(tier.tier);
  const safeLabel = sanitizeSvgValue(label);
  const safeValue = sanitizeSvgValue(value);

  return `
  <g>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="${tier.color}" opacity="${tier.glowIntensity * 0.25}" filter="url(#softGlow)"/>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="${colors.cardBackground}"/>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="url(#mainGradient)" opacity="0.5"/>
    <rect x="${x + 1}" y="${y + 1}" width="${size - 2}" height="${size - 2}" rx="${r - 1}" fill="none" stroke="${tier.color}" stroke-width="2" opacity="0.85"/>
    <g transform="translate(${cx - 12}, ${cy - 13})" fill="none" stroke="${tier.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${icon}
    </g>
    <circle cx="${x + size - 7}" cy="${y + 7}" r="9" fill="${tier.color}" stroke="${colors.background}" stroke-width="2"/>
    <text x="${x + size - 7}" y="${y + 11}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9.5" font-weight="800" fill="${colors.background}" text-anchor="middle">${safeTier}</text>
    <text x="${cx}" y="${y + size + 17}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="${trophyLabelFontSize(label)}" font-weight="600" fill="${colors.secondaryText}" text-anchor="middle">${safeLabel}</text>
    <text x="${cx}" y="${y + size + 32}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13" font-weight="800" fill="${colors.primaryText}" text-anchor="middle">${safeValue}</text>
  </g>`;
}

// classic style: hexagon
function renderTrophyHex({ x, y, size, tier, icon, label, value }) {
  const { colors } = currentTheme;
  const halfSize = size / 2;
  const safeTier = sanitizeSvgValue(tier.tier);
  const safeLabel = sanitizeSvgValue(label);
  const safeValue = sanitizeSvgValue(value);

  const points = (scale) => Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${x + halfSize + Math.cos(angle) * halfSize * scale},${y + halfSize + Math.sin(angle) * halfSize * scale}`;
  }).join(' ');
  const hexPath = points(0.85);
  const innerHexPath = points(0.75);

  return `
  <g>
    <polygon points="${hexPath}" fill="${tier.color}" opacity="${tier.glowIntensity * 0.3}" filter="url(#softGlow)"/>
    <polygon points="${hexPath}" fill="${colors.cardBackground}"/>
    <polygon points="${hexPath}" fill="url(#mainGradient)" opacity="0.4"/>
    <polygon points="${hexPath}" fill="none" stroke="${tier.color}" stroke-width="2" opacity="0.8"/>
    <polygon points="${innerHexPath}" fill="none" stroke="${tier.color}" stroke-width="1" opacity="0.3"/>
    <g transform="translate(${x + halfSize - 12}, ${y + halfSize - 14})" fill="none" stroke="${tier.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${icon}
    </g>
    <circle cx="${x + size - 8}" cy="${y + 12}" r="9" fill="${tier.color}" stroke="${colors.background}" stroke-width="2"/>
    <text x="${x + size - 8}" y="${y + 16}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9.5" font-weight="800" fill="${colors.background}" text-anchor="middle">${safeTier}</text>
    <text x="${x + halfSize}" y="${y + size + 17}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="${trophyLabelFontSize(label)}" font-weight="600" fill="${colors.secondaryText}" text-anchor="middle">${safeLabel}</text>
    <text x="${x + halfSize}" y="${y + size + 32}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13" font-weight="800" fill="${colors.primaryText}" text-anchor="middle">${safeValue}</text>
  </g>`;
}

const TROPHY_STYLES = {
  modern: renderTrophyHex,
  classic: renderTrophyMedallion,
  grid: renderTrophyTile,
};

function renderTrophyBadge({ style = 'classic', ...props }) {
  const render = TROPHY_STYLES[style] || renderTrophyMedallion;
  return render(props);
}

// renders the trophy row
export function renderTrophyRow({ x, y, width, height, data, style = 'classic' }) {
  const { colors } = currentTheme;
  const trophyDescription = sanitizeSvgValue(
  `Achievements: ${data.commits} commits, ` +
  `${data.prs} pull requests, ` +
  `${data.reviews} reviews, ` +
  `${data.issues} issues, ` +
  `${data.repos} repositories, ` +
  `${data.stars} stars, ` +
  `${data.followers} followers, ` +
  `${data.contributedRepos} open source contributions, ` +
  `${data.forks} forked repositories, ` +
  `${data.discussions} discussions.`
);
  // trophy icons (24x24 stroke icons rendered with the tier color)
  const icons = {
    commits: '<circle cx="12" cy="12" r="3.6"/><line x1="2" y1="12" x2="8.4" y2="12"/><line x1="15.6" y1="12" x2="22" y2="12"/>',
    prs: '<circle cx="6" cy="18" r="2.6"/><circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><line x1="6" y1="8.6" x2="6" y2="15.4"/><path d="M18 8.6v3.9a3.5 3.5 0 0 1-3.5 3.5H11"/>',
    reviews: '<path d="M21.5 11.5V12a9.5 9.5 0 1 1-5.6-8.7"/><polyline points="22 4.5 12 14.5 9 11.5"/>',
    issues: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="7.8" x2="12" y2="12.5"/><line x1="12" y1="16.2" x2="12.01" y2="16.2"/>',
    repos: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    stars: '<polygon points="12 2.6 15 8.7 21.7 9.6 16.9 14.3 18 21 12 17.8 6 21 7.1 14.3 2.3 9.6 9 8.7 12 2.6"/>',
    followers: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.2" r="3.4"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M15.5 3.8a3.4 3.4 0 0 1 0 6.7"/>',
    impact: '<circle cx="12" cy="12" r="9.4"/><line x1="2.6" y1="12" x2="21.4" y2="12"/><path d="M12 2.6c2.4 2.6 3.8 5.9 3.8 9.4S14.4 18.8 12 21.4c-2.4-2.6-3.8-5.9-3.8-9.4S9.6 5.2 12 2.6z"/>',
    forks: '<circle cx="6" cy="18" r="2.6"/><circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><line x1="6" y1="8.6" x2="6" y2="15.4"/><path d="M18 8.6a9 9 0 0 1-9 9"/>',
    discussions: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  };

  // thresholds for each trophy type
  const thresholds = {
    commits: { s: 5000, a: 2000, b: 500, c: 100 },
    prs: { s: 500, a: 200, b: 50, c: 10 },
    issues: { s: 300, a: 100, b: 30, c: 10 },
    repos: { s: 100, a: 50, b: 20, c: 5 },
    stars: { s: 1000, a: 500, b: 100, c: 20 },
    followers: { s: 1000, a: 500, b: 100, c: 20 },
    reviews: { s: 200, a: 100, b: 50, c: 10 },
    impact: { s: 100, a: 50, b: 20, c: 5 },
    forks: { s: 100, a: 50, b: 20, c: 5 },
    discussions: { s: 500, a: 200, b: 50, c: 10 },
  };

  const trophySize = 70;
  const trophyGap = 16;
  const totalTrophies = 10;
  const totalWidth = (trophySize * totalTrophies) + (trophyGap * (totalTrophies - 1));
  const startX = x + (width - totalWidth) / 2;

  const customLabels = currentTheme.domainConfig?.trophyLabels || {};

  // trophy data
  const trophies = [
    { key: 'commits', label: customLabels.commits || 'Commits', value: data.commits },
    { key: 'prs', label: customLabels.prs || 'PRs', value: data.prs },
    { key: 'reviews', label: customLabels.reviews || 'Reviews', value: data.reviews },
    { key: 'issues', label: customLabels.issues || 'Issues', value: data.issues },
    { key: 'repos', label: customLabels.repos || 'Repos', value: data.repos },
    { key: 'stars', label: customLabels.stars || 'Stars', value: data.stars },
    { key: 'followers', label: customLabels.followers || 'Followers', value: data.followers },
    { key: 'impact', label: customLabels.impact || 'Impact', value: data.contributedRepos },
    { key: 'forks', label: customLabels.forks || 'Forked', value: data.forks },
    { key: 'discussions', label: customLabels.discussions || 'Discussions', value: data.discussions },
  ];

  // card background
  const cardContent = `
  <g
  role="group"
  aria-labelledby="trophy-title"
  >
  <title id="trophy-title">Achievement Trophies</title>
  <desc>${trophyDescription}</desc>
    ${renderCardFrame({
      x, y, width, height,
      title: 'Achievement Trophies',
      titleId: 'trophy-title',
      gradOpacity: 0.3,
      borderOpacity: 0.6,
      titleY: 26,
      centerTitle: true,
      accentComment: '<!-- title accent -->',
    }).join('\n    ')}
  </g>`;

  // renders trophies
  const trophyContent = trophies.map((trophy, index) => {
    const numericValue = Number(trophy.value) || 0;
    const tier = getTrophyTier(numericValue, thresholds[trophy.key]);
    const trophyX = startX + (index * (trophySize + trophyGap));
    const trophyY = y + 48;

    // format value for display
    const displayValue = numericValue >= 1000
      ? (numericValue / 1000).toFixed(1) + 'k'
      : String(numericValue);

    return renderTrophyBadge({
      style,
      x: trophyX,
      y: trophyY,
      size: trophySize,
      tier: tier,
      icon: icons[trophy.key],
      label: trophy.label,
      value: displayValue,
    });
  }).join('\n');

  return cardContent + trophyContent;
}

export const DOMAIN_DNA_RULES = [
  { name: 'Android', languages: ['kotlin', 'java'], keywords: ['android', 'compose', 'jetpack', 'gradle', 'firebase'] },
  { name: 'iOS/macOS', languages: ['swift', 'objective-c'], keywords: ['ios', 'swiftui', 'uikit', 'xcode', 'macos', 'cocoapods'] },
  { name: 'Web Dev', languages: ['javascript', 'typescript', 'html', 'css', 'scss', 'vue', 'svelte'], keywords: ['web', 'frontend', 'backend', 'react', 'nextjs', 'node', 'express', 'fullstack'] },
  { name: 'AI / ML', languages: ['python', 'r', 'julia'], keywords: ['ai', 'ml', 'tensorflow', 'pytorch', 'openai', 'llm', 'langchain', 'data-science'] },
  { name: 'Game Dev', languages: ['c#', 'c++', 'gdscript'], keywords: ['game', 'unity', 'unreal', 'godot', 'opengl', 'vulkan', 'directx'] }
];

export function matchesConfig(repo, config) {
  const lang = (repo.language || '').toLowerCase();
  const name = (repo.name || '').toLowerCase();
  const desc = (repo.description || '').toLowerCase();

  let topics = [];
  if (Array.isArray(repo.topics)) {
    topics = repo.topics.map(t => String(t).toLowerCase());
  }

  if (config.languages && config.languages.map(l => l.toLowerCase()).includes(lang)) {
    return true;
  }

  if (config.keywords) {
    for (const kw of config.keywords) {
      const kwLower = kw.toLowerCase();
      if (name.includes(kwLower) || desc.includes(kwLower) || topics.includes(kwLower)) {
        return true;
      }
    }
  }

  return false;
}

export function calculateDeveloperDNA(repos) {
  if (!Array.isArray(repos) || repos.length === 0) return [];

  const scores = DOMAIN_DNA_RULES.map(rule => {
    let score = 0;
    repos.forEach(repo => {
      if (matchesConfig(repo, rule)) {
        score++;
      }
    });
    return { name: rule.name, score };
  });

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  if (totalScore === 0) return [];

  return scores
    .map(s => ({
      name: s.name,
      percentage: Math.round((s.score / totalScore) * 100)
    }))
    .filter(s => s.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);
}

export function calculateDomainInsights(theme, repos) {
  if (!theme.domainConfig?.insightsConfig || !Array.isArray(repos) || repos.length === 0) {
    return null;
  }

  const { title, metrics } = theme.domainConfig.insightsConfig;
  const totalRepos = repos.length;

  const stats = metrics.map(m => {
    const matchingCount = repos.filter(r => matchesConfig(r, m)).length;
    let valStr = String(matchingCount);

    if (m.isRatio) {
      const ratio = Math.round((matchingCount / totalRepos) * 100);
      valStr = `${ratio}%`;
    }

    return {
      label: m.label,
      value: valStr
    };
  });

  return { title, stats };
}

export function renderDeveloperPersonaCard({ x, y, width, height, dna, badges }) {
  const { colors } = getTheme();
  const cardId = `developer-persona-${x}-${y}`;

  // Left side: Developer DNA
  let dnaContent = `
    <text x="${x + 20}" y="${y + 50}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="${colors.secondaryText}" letter-spacing="0.5">DEVELOPER DNA</text>
  `;

  if (dna.length === 0) {
    dnaContent += `
      <text x="${x + 20}" y="${y + 80}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" fill="${colors.mutedText}">No repository metrics detected</text>
    `;
  } else {
    dna.slice(0, 3).forEach((item, index) => {
      const itemY = y + 72 + index * 18;
      const barWidth = 140;
      const filledWidth = Math.round((item.percentage / 100) * barWidth);

      dnaContent += `
        <text x="${x + 20}" y="${itemY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="${colors.primaryText}">${sanitizeSvgValue(item.name)}</text>

        <!-- progress bar background -->
        <rect x="${x + 105}" y="${itemY - 8}" width="${barWidth}" height="8" rx="4" ry="4" fill="${colors.border}" />

        <!-- progress bar fill -->
        <rect x="${x + 105}" y="${itemY - 8}" width="${filledWidth}" height="8" rx="4" ry="4" fill="${colors.accent}" />

        <text x="${x + 105 + barWidth + 12}" y="${itemY - 1}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="700" fill="${colors.accent}">${item.percentage}%</text>
      `;
    });
  }

  // Right side: Tech Badges
  let badgesContent = `
    <text x="${x + 380}" y="${y + 50}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="${colors.secondaryText}" letter-spacing="0.5">TECH STACK DIRECTORY</text>
  `;

  if (badges.length === 0) {
    badgesContent += `
      <text x="${x + 380}" y="${y + 80}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" fill="${colors.mutedText}">No specialized technologies detected</text>
    `;
  } else {
    let startX = x + 380;
    let badgeY = y + 68;
    let rowCount = 0;

    badges.slice(0, 8).forEach((badgeName, index) => {
      const pillWidth = 24 + badgeName.length * 6;

      if (startX + pillWidth > x + width - 20) {
        startX = x + 380;
        badgeY += 24;
        rowCount++;
      }

      if (rowCount < 2) {
        badgesContent += `
          <g>
            <rect x="${startX}" y="${badgeY}" width="${pillWidth}" height="18" rx="9" ry="9" fill="${colors.accent}" opacity="0.08" />
            <rect x="${startX}" y="${badgeY}" width="${pillWidth}" height="18" rx="9" ry="9" fill="none" stroke="${colors.accent}" stroke-width="1" opacity="0.3" />
            <text x="${startX + pillWidth / 2}" y="${badgeY + 13}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9.5" font-weight="600" fill="${colors.accent}" text-anchor="middle">${sanitizeSvgValue(badgeName)}</text>
          </g>
        `;
        startX += pillWidth + 8;
      }
    });
  }

  return `
  <g role="group" aria-labelledby="${cardId}-title">
    <!-- card background -->
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${LAYOUT.cardRadius}" ry="${LAYOUT.cardRadius}" fill="${colors.cardBackground}"/>
    <!-- inner gradient -->
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${LAYOUT.cardRadius}" ry="${LAYOUT.cardRadius}" fill="url(#mainGradient)" opacity="0.3"/>
    <!-- border -->
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="${height - 1}" rx="${LAYOUT.cardRadius}" ry="${LAYOUT.cardRadius}" fill="none" stroke="${colors.borderLight}" stroke-width="1" opacity="0.4"/>

    <!-- title -->
    <text id="${cardId}-title" x="${x + 20}" y="${y + 26}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13" font-weight="600" fill="${colors.secondaryText}" letter-spacing="0.5">DEVELOPER PERSONA PROFILE</text>
    <rect x="${x + 20}" y="${y + 34}" width="28" height="2" rx="1" fill="url(#accentGradient)" opacity="0.7"/>

    <!-- divider -->
    <line x1="${x + 350}" y1="${y + 45}" x2="${x + 350}" y2="${y + height - 25}" stroke="${colors.border}" stroke-width="1" opacity="0.4" />

    ${dnaContent}
    ${badgesContent}
  </g>`;
}

// wrap content in SVG root element
export function wrapSvg(
  content,
  width,
  height,
  accessibility = {}
) {
  const title = accessibility.title || 'GitHub Dashboard';
  const description = accessibility.description || 'GitHub profile statistics';

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-labelledby="dashboard-title dashboard-desc"
  xml:lang="en"
  lang="en"
>
<title id="dashboard-title">${title}</title>
<desc id="dashboard-desc">${description}</desc>

${renderDefs()}
${content}
</svg>`;
}

export { LAYOUT };
