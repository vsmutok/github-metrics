// Chart Renderer
import {
  buildContributionSummary,
  buildLanguageSummary,
} from '../utils/svg-accessibility.js';
import { getTheme, LAYOUT, renderCardFrame } from './svg.renderer.js';
import { sanitizeSvgValue } from '../utils/svg-sanitizer.js';

// generate a smooth SVG path using cardinal spline interpolation
function smoothPath(points) {
  if (points.length < 2) return '';
  points = points.filter(
  (p) =>
    Number.isFinite(p?.x) &&
    Number.isFinite(p?.y)
);

if (points.length < 2) return '';

  const tension = 0.3;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? i + 1 : i + 2];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

// scale data points to fit within chart dimensions
function scaleData(data, width, height, padding) {
  if (!Array.isArray(data) || data.length === 0) {
  return [];
}
  const numericData = data
  .map((v) => Number(v))
  .filter(Number.isFinite);

if (numericData.length === 0) {
  return [];
}

const maxVal = Math.max(...numericData);
const minVal = Math.min(...numericData);
  const range = maxVal - minVal || 1;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const denominator = Math.max(1, data.length - 1);

return numericData.map((val, i) => ({
  x: padding + (i / denominator) * chartWidth,
  y: padding + chartHeight - ((val - minVal) / range) * chartHeight,
  value: val,
}));
}

function buildYAxisTicks(minVal, maxVal, count = 4) {
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
  return Array.from({ length: count + 1 }, (_, i) => ({
    value: 0,
    ratio: i / count,
  }));
}
  const range = maxVal - minVal;
  if (range === 0) {
    return Array.from({ length: count + 1 }, (_, i) => ({
      value: minVal,
      ratio: i / count,
    }));
  }

  return Array.from({ length: count + 1 }, (_, i) => {
    const ratio = i / count;
    return {
      value: Math.round(maxVal - ratio * range),
      ratio,
    };
  });
}

function formatAxisDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// render a modern line/area chart with glow effects
export function renderLineChart({
  x,
  y,
  width,
  height,
  data,
  showArea = true,
  showLine = true,
  showGlow = true,
  showDots = false,
  uniqueId,
  showAxes = false,
  xLabel = 'Timeline',
  yLabel = 'Contributions',
  xTickLabels = [],
}) {
  const theme = getTheme();
  const { colors } = theme;
  const flat = theme.flat === true;
  const safeXLabel = sanitizeSvgValue(xLabel);
  const safeYLabel = sanitizeSvgValue(yLabel);
  const padding = 12;
  const id = uniqueId || `chart-${x}-${y}`;
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);

  const points = scaleData(data, width, height, padding);
  const pathD = smoothPath(points);

  let elements = [];

  // gradient definitions for this chart
  elements.push(`
    <defs>
      <linearGradient id="lineGradient-${id}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${flat ? colors.accent : colors.gradientStart}"/>
        <stop offset="50%" stop-color="${flat ? colors.accent : colors.gradientMid}"/>
        <stop offset="100%" stop-color="${flat ? colors.accent : colors.gradientEnd}"/>
      </linearGradient>
      <linearGradient id="areaGradient-${id}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${colors.accent}" stop-opacity="0.4"/>
        <stop offset="50%" stop-color="${colors.accentSecondary}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="${colors.accent}" stop-opacity="0"/>
      </linearGradient>
      <filter id="lineGlow-${id}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  `);

  // subtle grid lines
  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const lineY = padding + (i / 4) * (height - padding * 2);
    gridLines.push(`<line x1="${padding}" y1="${lineY}" x2="${width - padding}" y2="${lineY}" stroke="${colors.border}" stroke-width="1" opacity="0.3" stroke-dasharray="4 4"/>`);
  }
  elements.push(gridLines.join('\n'));

  if (showAxes) {
    const leftX = padding;
    const rightX = width - padding;
    const topY = padding;
    const bottomY = height - padding;
    const yTicks = buildYAxisTicks(minVal, maxVal);
    const xTicks = xTickLabels.length === 3
      ? [
          { ratio: 0, label: xTickLabels[0] },
          { ratio: 0.5, label: xTickLabels[1] },
          { ratio: 1, label: xTickLabels[2] },
        ]
      : [
          { ratio: 0, label: 'Start' },
          { ratio: 0.5, label: 'Mid' },
          { ratio: 1, label: 'Now' },
        ];

    elements.push(`<line x1="${leftX}" y1="${bottomY}" x2="${rightX}" y2="${bottomY}" stroke="${colors.borderLight}" stroke-width="1.2" opacity="0.7"/>`);
    elements.push(`<line x1="${leftX}" y1="${topY}" x2="${leftX}" y2="${bottomY}" stroke="${colors.borderLight}" stroke-width="1.2" opacity="0.7"/>`);

    yTicks.forEach((tick) => {
      const yPos = topY + tick.ratio * (bottomY - topY);
      elements.push(`<line x1="${leftX - 4}" y1="${yPos}" x2="${leftX}" y2="${yPos}" stroke="${colors.secondaryText}" stroke-width="1" opacity="0.7"/>`);
      elements.push(`<text x="${leftX - 8}" y="${yPos + 3}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="8.5" fill="${colors.mutedText}" text-anchor="end">${sanitizeSvgValue(tick.value)}</text>`);
    });

    xTicks.forEach((tick) => {
      const xPos = leftX + tick.ratio * (rightX - leftX);
      const safeTickLabel = sanitizeSvgValue(tick.label);
      elements.push(`<line x1="${xPos}" y1="${bottomY}" x2="${xPos}" y2="${bottomY + 4}" stroke="${colors.secondaryText}" stroke-width="1" opacity="0.7"/>`);
      elements.push(`<text x="${xPos}" y="${bottomY + 14}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="8.5" fill="${colors.mutedText}" text-anchor="middle">${safeTickLabel}</text>`);
    });

    elements.push(`<text x="${(leftX + rightX) / 2}" y="${height + 22}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.secondaryText}" text-anchor="middle">${safeXLabel}</text>`);
    elements.push(`<text x="${leftX - 36}" y="${(topY + bottomY) / 2}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.secondaryText}" text-anchor="middle" transform="rotate(-90, ${leftX - 36}, ${(topY + bottomY) / 2})">${safeYLabel}</text>`);
  }

  // area fill with gradient
  if (showArea && points.length > 1) {
    const areaPath = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    elements.push(`<path d="${areaPath}" fill="url(#areaGradient-${id})"/>`);
  }

  // line stroke with optional glow
  if (showLine && pathD) {
    if (showGlow) {
      elements.push(`<path d="${pathD}" fill="none" stroke="url(#lineGradient-${id})" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" filter="url(#lineGlow-${id})"/>`);
    }
    // main line
    elements.push(`<path d="${pathD}" fill="none" stroke="url(#lineGradient-${id})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // dots at data points with glow
  if (showDots && points.length <= 15) {
    points.forEach((point, i) => {
      const dotColor = i === points.length - 1 ? colors.gradientEnd : colors.gradientStart;
      elements.push(`
        <circle cx="${point.x}" cy="${point.y}" r="5" fill="${dotColor}" opacity="0.3" filter="url(#lineGlow-${id})"/>
        <circle cx="${point.x}" cy="${point.y}" r="3" fill="${dotColor}"/>
        <circle cx="${point.x}" cy="${point.y}" r="1.5" fill="#fff" opacity="0.8"/>
      `);
    });
  }

  // end point highlight
  if (points.length > 0) {
    const lastPoint = points[points.length - 1];
    elements.push(`
      <circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="6" fill="${colors.gradientEnd}" opacity="0.3"/>
      <circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="4" fill="${colors.gradientEnd}"/>
      <circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="2" fill="#fff" opacity="0.9"/>
    `);
  }

  return `
  <g transform="translate(${x}, ${y})">
    ${elements.join('\n    ')}
  </g>`;
}

// modern style: vertical bars
function renderContributionBars({ x, y, width, height, title, data }) {
  const { colors } = getTheme();
  const chartDescription = sanitizeSvgValue(
  buildContributionSummary(data)
);
  const values = (Array.isArray(data) ? data : []).map((value) => Number(value) || 0);
  const padX = 22;
  const top = y + 50;
  const bottom = y + height - 30;
  const chartH = Math.max(1, bottom - top);
  const chartW = width - padX * 2;
  const count = Math.max(1, values.length);
  const max = Math.max(1, ...values);
  const gap = 3;
  const barW = Math.max(1, (chartW - gap * (count - 1)) / count);

  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const gy = top + ratio * chartH;
    return `<line x1="${x + padX}" y1="${gy}" x2="${x + width - padX}" y2="${gy}" stroke="${colors.border}" stroke-width="1" opacity="0.35"/>`;
  }).join('\n    ');

  const bars = values.map((value, index) => {
    const barH = Math.max(2, (value / max) * chartH);
    const bx = x + padX + index * (barW + gap);
    const by = bottom - barH;
    const color = index === values.length - 1 ? colors.gradientEnd : colors.gradientStart;
    const opacity = (0.45 + 0.55 * (value / max)).toFixed(2);
    return `<rect x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="${Math.min(2.5, barW / 2)}" fill="${color}" opacity="${opacity}"/>`;
  }).join('\n    ');

  const totalDays = Math.max(1, values.length);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - (totalDays - 1));
  const middleDate = new Date(startDate);
  middleDate.setUTCDate(startDate.getUTCDate() + Math.floor((totalDays - 1) / 2));
  const labelY = y + height - 11;
  const labels = `
    <text x="${x + padX}" y="${labelY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}">${formatAxisDate(startDate)}</text>
    <text x="${x + width / 2}" y="${labelY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}" text-anchor="middle">${formatAxisDate(middleDate)}</text>
    <text x="${x + width - padX}" y="${labelY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}" text-anchor="end">${formatAxisDate(endDate)}</text>`;

  return `
  <g
  role="group"
  aria-labelledby="contrib-title"
  >
  <title id="contrib-title">Contribution Activity</title>
  <desc>${chartDescription}</desc>
    ${renderCardFrame({
      x, y, width, height, title,
      titleId: 'contrib-title',
      gradOpacity: 0.35,
      borderOpacity: 0.6,
      titleY: 27,
      accentComment: '<!-- title accent -->',
    }).join('\n    ')}

    <!-- baseline -->
    <line x1="${x + padX}" y1="${bottom}" x2="${x + width - padX}" y2="${bottom}" stroke="${colors.borderLight}" stroke-width="1" opacity="0.8"/>
    ${grid}
    ${bars}
    ${labels}
  </g>`;
}

// classic style: smooth gradient area line
function renderContributionArea({ x, y, width, height, title, data }) {
  const { colors } = getTheme();
  const chartDescription = sanitizeSvgValue(buildContributionSummary(data));
  const chartWidth = width - 40;
  const chartHeight = height - 90;
  const totalDays = Math.max(1, (Array.isArray(data) ? data : []).length);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - (totalDays - 1));
  const middleDate = new Date(startDate);
  middleDate.setUTCDate(startDate.getUTCDate() + Math.floor((totalDays - 1) / 2));
  const xTickLabels = [formatAxisDate(startDate), formatAxisDate(middleDate), formatAxisDate(endDate)];

  return `
  <g role="group" aria-labelledby="contrib-title">
  <title id="contrib-title">Contribution Activity</title>
  <desc>${chartDescription}</desc>
    ${renderCardFrame({
      x, y, width, height, title,
      titleId: 'contrib-title',
      gradOpacity: 0.35,
      borderOpacity: 0.6,
      titleY: 27,
      accentComment: '<!-- title accent -->',
    }).join('\n    ')}
    <g transform="translate(${x + 20}, ${y})">
      ${renderLineChart({
        x: 0,
        y: 44,
        width: chartWidth,
        height: chartHeight,
        data,
        showArea: false,
        showLine: true,
        showGlow: false,
        showDots: false,
        uniqueId: 'contrib',
        showAxes: true,
        xLabel: 'Timeline (last 30 days)',
        yLabel: 'Contributions',
        xTickLabels,
      })}
    </g>
  </g>`;
}

// grid style: contribution heat strip
function renderContributionHeatmap({ x, y, width, height, title, data }) {
  const { colors } = getTheme();
  const chartDescription = sanitizeSvgValue(buildContributionSummary(data));
  const values = (Array.isArray(data) ? data : []).map((value) => Number(value) || 0);
  const padX = 22;
  const count = Math.max(1, values.length);
  const max = Math.max(1, ...values);
  const gap = 3;
  const cellW = Math.max(4, (width - padX * 2 - gap * (count - 1)) / count);
  const cellH = Math.min(36, cellW * 2.6);
  const top = y + 62;

  const squares = values.map((value, index) => {
    const cx = x + padX + index * (cellW + gap);
    if (value <= 0) {
      return `<rect x="${cx}" y="${top}" width="${cellW}" height="${cellH}" rx="3" fill="${colors.border}" opacity="0.5"/>`;
    }
    const opacity = (0.35 + 0.65 * (value / max)).toFixed(2);
    return `<rect x="${cx}" y="${top}" width="${cellW}" height="${cellH}" rx="3" fill="url(#accentGradient)" opacity="${opacity}"/>`;
  }).join('\n    ');

  const totalDays = Math.max(1, values.length);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - (totalDays - 1));
  const middleDate = new Date(startDate);
  middleDate.setUTCDate(startDate.getUTCDate() + Math.floor((totalDays - 1) / 2));
  const labelY = top + cellH + 18;
  const dateLabels = `
    <text x="${x + padX}" y="${labelY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}">${formatAxisDate(startDate)}</text>
    <text x="${x + width / 2}" y="${labelY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}" text-anchor="middle">${formatAxisDate(middleDate)}</text>
    <text x="${x + width - padX}" y="${labelY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}" text-anchor="end">${formatAxisDate(endDate)}</text>`;

  const legendX = x + padX;
  const legendY = y + height - 20;
  const legend = `
    <text x="${legendX}" y="${legendY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}">Less</text>
    ${[0.25, 0.5, 0.75, 1].map((opacity, i) => `<rect x="${legendX + 28 + i * 14}" y="${legendY - 8}" width="10" height="10" rx="2.5" fill="url(#accentGradient)" opacity="${opacity}"/>`).join('')}
    <text x="${legendX + 28 + 4 * 14 + 6}" y="${legendY}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}">More</text>`;

  return `
  <g role="group" aria-labelledby="contrib-title">
  <title id="contrib-title">Contribution Activity</title>
  <desc>${chartDescription}</desc>
    ${renderCardFrame({
      x, y, width, height, title,
      titleId: 'contrib-title',
      gradOpacity: 0.35,
      borderOpacity: 0.6,
      titleY: 27,
      accentComment: '<!-- title accent -->',
    }).join('\n    ')}
    ${squares}
    ${dateLabels}
    ${legend}
  </g>`;
}

const CONTRIBUTION_STYLES = {
  modern: renderContributionArea,
  classic: renderContributionBars,
  grid: renderContributionHeatmap,
};

// render the contribution card for the requested style
export function renderContributionChart({ style = 'classic', ...props }) {
  const render = CONTRIBUTION_STYLES[style] || renderContributionBars;
  return render(props);
}

// generate fake contribution data with realistic pattern
export function generateFakeContributionData(days = 30) {
  const data = [];
  let base = 8;
  const weekPattern = [0.3, 0.7, 1.0, 1.2, 1.0, 0.5, 0.2];

  for (let i = 0; i < days; i++) {
    const dayOfWeek = i % 7;
    const weekMultiplier = weekPattern[dayOfWeek];
    const randomVariation = Math.floor(Math.random() * 8) - 3;
    const trend = Math.sin(i / 5) * 3;

    base = Math.max(1, Math.min(20, base + randomVariation * 0.3));
    const value = Math.max(0, Math.floor(base * weekMultiplier + trend));
    data.push(value);
  }

  return data;
}

// modern style: horizontal progress bars
function renderLanguageBars({ x, y, width, height, title, data }) {
  const { colors, chartColors } = getTheme();
  const chartDescription = sanitizeSvgValue(
  buildLanguageSummary(data)
);
  const activeTheme = getTheme();
  const highlightLangs = activeTheme.domainConfig?.highlightedLanguages || [];

  const items = (Array.isArray(data) ? data : []).slice(0, 5);
  const total = Math.max(1, items.reduce((sum, item) => sum + (Number(item.value) || 0), 0));

  const trackX = x + 22;
  const trackW = width - 44;
  const top = y + 52;
  const available = (y + height - 14) - top;
  const rowH = available / Math.max(1, items.length);

  const rows = items.map((item, i) => {
    const value = Number(item.value) || 0;
    const pct = Math.round((value / total) * 100);
    const color = chartColors[i % chartColors.length];
    const isHighlighted = highlightLangs.includes(String(item.label).toLowerCase());
    const prefix = (isHighlighted && activeTheme.domainConfig?.languagePrefix)
      ? activeTheme.domainConfig.languagePrefix + ' '
      : '';
    const safeLabel = sanitizeSvgValue(prefix + item.label);
    const rowTop = top + i * rowH;
    const fillW = Math.max(3, (trackW * pct) / 100);

    return `
      <g>
        <circle cx="${trackX + 4}" cy="${rowTop + 9}" r="4" fill="${color}"/>
        <text x="${trackX + 15}" y="${rowTop + 13}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" font-weight="${isHighlighted ? '700' : '500'}" fill="${colors.primaryText}">${safeLabel}</text>
        <text x="${x + width - 22}" y="${rowTop + 13}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="700" fill="${color}" text-anchor="end">${pct}%</text>
        <rect x="${trackX}" y="${rowTop + 18}" width="${trackW}" height="5" rx="2.5" fill="${colors.border}"/>
        <rect x="${trackX}" y="${rowTop + 18}" width="${fillW}" height="5" rx="2.5" fill="${color}"/>
      </g>`;
  }).join('');

  return `
  <g
  role="group"
  aria-labelledby="language-title"
  >
  <title id="language-title">Top Languages</title>
  <desc>${chartDescription}</desc>
    ${renderCardFrame({
      x, y, width, height, title,
      titleId: 'language-title',
      gradOpacity: 0.35,
      borderOpacity: 0.6,
      titleY: 27,
      accentComment: '<!-- title accent -->',
    }).join('\n    ')}

    <!-- language bars -->
    ${rows}
  </g>`;
}

// create an SVG arc path for a donut slice
function describeArc(cx, cy, outerR, innerR, startAngle, endAngle) {
  const gap = 0.03;
  const adjustedStart = startAngle + gap;
  const adjustedEnd = endAngle - gap;

  if (adjustedEnd <= adjustedStart) {
    return '';
  }

  const startOuter = { x: cx + outerR * Math.cos(adjustedStart), y: cy + outerR * Math.sin(adjustedStart) };
  const endOuter = { x: cx + outerR * Math.cos(adjustedEnd), y: cy + outerR * Math.sin(adjustedEnd) };
  const startInner = { x: cx + innerR * Math.cos(adjustedEnd), y: cy + innerR * Math.sin(adjustedEnd) };
  const endInner = { x: cx + innerR * Math.cos(adjustedStart), y: cy + innerR * Math.sin(adjustedStart) };
  const largeArc = adjustedEnd - adjustedStart > Math.PI ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    `Z`,
  ].join(' ');
}

// classic style: donut with legend
function renderLanguageDonut({ x, y, width, height, title, data }) {
  const { colors, chartColors } = getTheme();
  const chartDescription = sanitizeSvgValue(buildLanguageSummary(data));
  const chartAreaWidth = width * 0.42;
  const centerX = x + chartAreaWidth / 2 + 20;
  const centerY = y + height / 2 + 12;
  const outerRadius = Math.min(chartAreaWidth, height - 70) / 2 - 4;
  const innerRadius = outerRadius * 0.62;
  const total = Math.max(1, data.reduce((sum, item) => sum + (Number(item.value) || 0), 0));

  let currentAngle = -Math.PI / 2;
  const slices = [];
  data.forEach((item, i) => {
    const value = Number(item.value) || 0;
    const sliceAngle = (value / total) * Math.PI * 2;
    const path = describeArc(centerX, centerY, outerRadius, innerRadius, currentAngle, currentAngle + sliceAngle);
    const color = chartColors[i % chartColors.length];
    if (path) {
      slices.push(`<path d="${path}" fill="${color}" opacity="0.2" filter="url(#softGlow)"/>`);
      slices.push(`<path d="${path}" fill="${color}" />`);
    }
    currentAngle += sliceAngle;
  });

  const centerDeco = `
    <circle cx="${centerX}" cy="${centerY}" r="${innerRadius - 4}" fill="${colors.cardBackground}" opacity="0.9"/>
    <circle cx="${centerX}" cy="${centerY}" r="${innerRadius - 8}" fill="url(#mainGradient)" opacity="0.5"/>
    <text x="${centerX}" y="${centerY + 4}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="700" fill="${colors.primaryText}" text-anchor="middle">${sanitizeSvgValue(total)}</text>
    <text x="${centerX}" y="${centerY + 18}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" fill="${colors.mutedText}" text-anchor="middle">REPOS</text>`;

  const legendX = x + chartAreaWidth + 32;
  const legendItemHeight = 28;
  const legendItems = data.slice(0, 6).map((item, i) => {
    const itemY = y + 52 + (i + 1) * legendItemHeight - legendItemHeight + 8;
    const percentage = Math.round(((Number(item.value) || 0) / total) * 100);
    const color = chartColors[i % chartColors.length];
    return `
      <g>
        <circle cx="${legendX + 6}" cy="${itemY + 4}" r="4" fill="${color}"/>
        <text x="${legendX + 18}" y="${itemY + 8}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" fill="${colors.primaryText}">${sanitizeSvgValue(item.label)}</text>
        <text x="${x + width - 24}" y="${itemY + 8}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="${color}" text-anchor="end">${percentage}%</text>
      </g>`;
  }).join('');

  return `
  <g role="group" aria-labelledby="language-title">
  <title id="language-title">Top Languages</title>
  <desc>${chartDescription}</desc>
    ${renderCardFrame({
      x, y, width, height, title,
      titleId: 'language-title',
      gradOpacity: 0.35,
      borderOpacity: 0.6,
      titleY: 27,
      accentComment: '<!-- title accent -->',
    }).join('\n    ')}
    ${slices.join('\n    ')}
    ${centerDeco}
    ${legendItems}
  </g>`;
}

// grid style: single stacked bar with a two-column legend
function renderLanguageStacked({ x, y, width, height, title, data }) {
  const { colors, chartColors } = getTheme();
  const chartDescription = sanitizeSvgValue(buildLanguageSummary(data));
  const items = (Array.isArray(data) ? data : []).slice(0, 6);
  const total = Math.max(1, items.reduce((sum, item) => sum + (Number(item.value) || 0), 0));

  const barX = x + 22;
  const barY = y + 52;
  const barW = width - 44;
  const barH = 16;
  let cursor = barX;
  const segments = items.map((item, i) => {
    const value = Number(item.value) || 0;
    const segW = (value / total) * barW;
    const color = chartColors[i % chartColors.length];
    const rect = `<rect x="${cursor}" y="${barY}" width="${Math.max(0, segW - 2)}" height="${barH}" rx="4" fill="${color}"/>`;
    cursor += segW;
    return rect;
  }).join('');

  const legendTop = barY + barH + 26;
  const rowH = 22;
  const half = Math.ceil(items.length / 2);
  const colW = (width - 44) / 2;
  const rows = items.map((item, i) => {
    const value = Number(item.value) || 0;
    const pct = Math.round((value / total) * 100);
    const color = chartColors[i % chartColors.length];
    const col = i < half ? 0 : 1;
    const row = i < half ? i : i - half;
    const lx = x + 22 + col * colW;
    const ly = legendTop + row * rowH;
    return `
      <g>
        <circle cx="${lx + 4}" cy="${ly}" r="4" fill="${color}"/>
        <text x="${lx + 15}" y="${ly + 4}" font-family="'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" fill="${colors.primaryText}">${sanitizeSvgValue(item.label)}</text>
        <text x="${lx + colW - 18}" y="${ly + 4}" font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="700" fill="${color}" text-anchor="end">${pct}%</text>
      </g>`;
  }).join('');

  return `
  <g role="group" aria-labelledby="language-title">
  <title id="language-title">Top Languages</title>
  <desc>${chartDescription}</desc>
    ${renderCardFrame({
      x, y, width, height, title,
      titleId: 'language-title',
      gradOpacity: 0.35,
      borderOpacity: 0.6,
      titleY: 27,
      accentComment: '<!-- title accent -->',
    }).join('\n    ')}
    ${segments}
    ${rows}
  </g>`;
}

const LANGUAGE_STYLES = {
  modern: renderLanguageDonut,
  classic: renderLanguageBars,
  grid: renderLanguageStacked,
};

// render the top-languages card for the requested style
export function renderDonutChart({ style = 'classic', ...props }) {
  const render = LANGUAGE_STYLES[style] || renderLanguageBars;
  return render(props);
}
