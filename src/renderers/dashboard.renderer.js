// Shared dashboard renderer.
// Builds the complete profile card from a normalized data model. It contains no
// Node.js dependency so the exact same code powers the Express route, the
// static preview generator and the browser studio preview.

import {
  renderBackground,
  renderHeader,
  renderCardWithStats,
  calculateCardWidth,
  calculateCardX,
  wrapSvg,
  renderTrophyRow,
  LAYOUT,
} from './svg.renderer.js';
import { renderContributionChart, renderDonutChart } from './chart.renderer.js';
import { renderCPSection } from './cp-section.renderer.js';

// Toggleable sections, in render order.
export const DASHBOARD_SECTIONS = Object.freeze([
  'header',
  'activity',
  'streak',
  'repos',
  'contribution',
  'languages',
  'trophies',
]);

export const DEFAULT_SECTIONS = Object.freeze({
  header: true,
  activity: true,
  streak: true,
  repos: true,
  contribution: true,
  languages: true,
  trophies: true,
});

// Available visual styles for the charts and trophies.
export const STYLE_NAMES = Object.freeze(['classic', 'modern', 'grid']);

export function normalizeStyle(value) {
  return STYLE_NAMES.includes(value) ? value : 'classic';
}

// Normalize a partial section map into a complete boolean map.
export function normalizeSections(input = {}) {
  const sections = {};
  for (const key of DASHBOARD_SECTIONS) {
    sections[key] = input[key] === undefined ? true : Boolean(input[key]);
  }
  return sections;
}

export function countVisibleSections(input = {}) {
  const sections = normalizeSections(input);
  return DASHBOARD_SECTIONS.filter((key) => sections[key]).length;
}

const ROW_HEIGHT = {
  stat: 140,
  chart: 200,
  cp: 140,
  trophy: 165,
};

const HEADER_Y = 52;
const FIRST_ROW_Y = 95;
const HEADERLESS_ROW_Y = 44;

/**
 * Render the dashboard content for a normalized model.
 *
 * @returns {{ content: string, width: number, height: number }}
 */
export function renderDashboard(model = {}) {
  const {
    user = {},
    align = 'left',
    activityStats = [],
    streakStats = [],
    thirdCard = null,
    contributionData = [],
    topLanguages = [],
    trophyData = null,
    cp = {},
    showCPSection = false,
    accessibility = {},
    sections: sectionsInput = {},
    style = 'classic',
  } = model;

  const sections = normalizeSections(sectionsInput);
  const showHeader = sections.header !== false;
  const fullWidth = LAYOUT.width - LAYOUT.padding * 2;
  const parts = [];
  let y = showHeader ? FIRST_ROW_Y : HEADERLESS_ROW_Y;
  let hasRow = false;

  const statCards = [];
  if (sections.activity) statCards.push({ title: 'GitHub Activity', stats: activityStats });
  if (sections.streak) statCards.push({ title: 'Streak Stats', stats: streakStats });
  if (sections.repos && thirdCard) statCards.push(thirdCard);

  if (statCards.length > 0) {
    const cardWidth = calculateCardWidth(statCards.length);
    statCards.forEach((card, index) => {
      parts.push(renderCardWithStats({
        x: calculateCardX(index, cardWidth),
        y,
        width: cardWidth,
        height: ROW_HEIGHT.stat,
        title: card.title,
        stats: card.stats,
      }));
    });
    y += ROW_HEIGHT.stat + LAYOUT.cardGap;
    hasRow = true;
  }

  const showContribution = sections.contribution;
  const showLanguages = sections.languages;

  if (showContribution || showLanguages) {
    if (showContribution && showLanguages) {
      const chartWidth = calculateCardWidth(2) + LAYOUT.cardGap / 2;
      const languageWidth = calculateCardWidth(2) - LAYOUT.cardGap / 2;
      parts.push(renderContributionChart({
        x: LAYOUT.padding,
        y,
        width: chartWidth,
        height: ROW_HEIGHT.chart,
        title: 'Contribution Activity',
        data: contributionData,
        style,
      }));
      parts.push(renderDonutChart({
        x: LAYOUT.padding + chartWidth + LAYOUT.cardGap,
        y,
        width: languageWidth,
        height: ROW_HEIGHT.chart,
        title: 'Top Languages',
        data: topLanguages,
        style,
      }));
    } else if (showContribution) {
      parts.push(renderContributionChart({
        x: LAYOUT.padding,
        y,
        width: fullWidth,
        height: ROW_HEIGHT.chart,
        title: 'Contribution Activity',
        data: contributionData,
        style,
      }));
    } else {
      parts.push(renderDonutChart({
        x: LAYOUT.padding,
        y,
        width: fullWidth,
        height: ROW_HEIGHT.chart,
        title: 'Top Languages',
        data: topLanguages,
        style,
      }));
    }
    y += ROW_HEIGHT.chart + LAYOUT.cardGap;
    hasRow = true;
  }

  if (showCPSection) {
    parts.push(renderCPSection({ x: LAYOUT.padding, y, width: fullWidth, ...cp }));
    y += ROW_HEIGHT.cp + LAYOUT.cardGap;
    hasRow = true;
  }

  if (sections.trophies && trophyData) {
    parts.push(renderTrophyRow({
      x: LAYOUT.padding,
      y,
      width: fullWidth,
      height: ROW_HEIGHT.trophy,
      data: trophyData,
      style,
    }));
    y += ROW_HEIGHT.trophy + LAYOUT.cardGap;
    hasRow = true;
  }

  const minHeight = (showHeader ? FIRST_ROW_Y : HEADERLESS_ROW_Y) + 40 + LAYOUT.padding;
  const height = hasRow
    ? y - LAYOUT.cardGap + LAYOUT.padding
    : minHeight;

  const content = [
    renderBackground(LAYOUT.width, height),
    showHeader ? renderHeader({
      x: LAYOUT.padding,
      y: HEADER_Y,
      title: user.title,
      subtitle: user.subtitle,
      avatarUrl: user.avatarUrl,
      align,
      handle: user.handle,
    }) : '',
    ...parts,
  ].filter(Boolean).join('\n');

  return { content, width: LAYOUT.width, height, accessibility };
}

// Convenience helper returning the complete SVG document.
export function renderDashboardSvg(model = {}) {
  const { content, width, height, accessibility } = renderDashboard(model);
  return wrapSvg(content, width, height, accessibility);
}

// Build the normalized model from the demo profile shape. Shared by the static
// generator, the theme-comparison route and the browser studio.
export function buildDemoModel(profile, { align = 'left', sections = {}, formatNumber = String, hideTrophies = false } = {}) {
  const {
    activity = {},
    streak = {},
    repository = {},
    languages = [],
    contributions = [],
    trophies = {},
    name,
    username,
    subtitle,
    avatarUrl,
  } = profile;

  const fmt = (value) => formatNumber(value);

  return {
    user: {
      title: name ? `${name}'s Dashboard` : `${username}'s Dashboard`,
      subtitle: subtitle || `@${username}`,
      avatarUrl,
      handle: username,
    },
    align,
    activityStats: [
      { label: 'Contributions', value: fmt(activity.contributions) },
      { label: 'PRs Opened', value: fmt(activity.prs) },
      { label: 'Issues Opened', value: fmt(activity.issues) },
    ],
    streakStats: [
      { label: 'Current', value: fmt(streak.current) },
      { label: 'Longest', value: fmt(streak.longest) },
      { label: 'Total', value: fmt(streak.total) },
    ],
    thirdCard: {
      title: 'Repository Stats',
      stats: [
        { label: 'Repositories', value: fmt(repository.repositories) },
        { label: 'Stars', value: fmt(repository.stars) },
        { label: 'Followers', value: fmt(repository.followers) },
      ],
    },
    contributionData: contributions,
    topLanguages: languages,
    trophyData: trophies,
    sections: hideTrophies ? { ...sections, trophies: false } : sections,
  };
}
