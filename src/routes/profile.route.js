import { Router } from 'express';
import { setTheme, wrapSvg } from '../renderers/svg.renderer.js';
import { renderDashboard } from '../renderers/dashboard.renderer.js';
import { getGitHubUserData } from '../services/github.service.js';
import { getContributionData } from '../services/github-graphql.service.js';
import { getTokenByKey } from '../services/token-store.service.js';
import config from '../config/index.js';
import { getLeetCodeData } from '../services/leetcode.service.js';
import { getCodeforcesData } from '../services/codeforces.service.js';
import { getCodeChefData } from '../services/codechef.service.js';
import { sendGracefulErrorSvg } from '../renderers/error.renderer.js';
import { sendLoadingSpinner } from '../renderers/loading.renderer.js';
import { GitHubErrorCode } from '../services/github.service.js';
import { trackProfileRequest } from '../services/analytics.service.js';
import { CF_RANK_MAP } from '../constants.js';
import { normalizeProfileQuery } from '../utils/query-validation.js';
import { buildDashboardAccessibility } from '../utils/svg-accessibility.js';
import { createHybridTheme, validateThemeAccessibility } from '../utils/theme-accessibility.js';

const router = Router();

const USER_KEY_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Resolve the OAuth token for a request, if any. A token is only applied when
 * the requested username matches the account that granted it, so a leaked
 * user_key cannot be used to read a different user's private data.
 */
async function resolveUserToken(req, username) {
  if (!config.oauth?.enabled) {
    return null;
  }
  const rawKey = typeof req.query.user_key === 'string' ? req.query.user_key.trim() : '';
  if (!USER_KEY_REGEX.test(rawKey)) {
    return null;
  }
  try {
    const stored = await getTokenByKey(rawKey);
    if (stored && stored.userId.toLowerCase() === username.toLowerCase()) {
      return stored.accessToken;
    }
  } catch (error) {
    console.error('Failed to resolve user token:', error?.message || error);
  }
  return null;
}

// Security: Implement strict Content-Security-Policy for SVG responses
router.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
  );
  next();
});

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

function getTopLanguages(repos, max = 5) {
  if (!Array.isArray(repos) || repos.length === 0) {
    return [];
  }
  const langCounts = {};
  repos.forEach((repo) => {
    const language = repo?.language;

    if (typeof language === 'string' && language.trim()) {
      langCounts[language] = (langCounts[language] || 0) + 1;
    }
  });
  return Object.entries(langCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max);
}

router.get('/', async (req, res) => {
  try {
    void trackProfileRequest(req);

    const {
      theme,
      style,
      align,
      sections,
      username,
      isUsernameValid,
      leetcode,
      codeforces,
      codechef,
      shouldRenderLeetCode,
      customThemeOverrides,
    } = normalizeProfileQuery(req.query);

    let activeTheme = setTheme(theme);
    if (customThemeOverrides && Object.keys(customThemeOverrides).length > 0) {
      const hybridTheme = createHybridTheme(activeTheme, customThemeOverrides);
      const contrastResult = validateThemeAccessibility(hybridTheme);
      if (!contrastResult.primaryPass || !contrastResult.secondaryPass) {
        console.warn(`[Accessibility] Custom theme has low contrast:`, contrastResult);
      }
      activeTheme = setTheme(hybridTheme);
    }

    if (!isUsernameValid) {
      return sendGracefulErrorSvg(res, {
        code: 'INVALID_USERNAME',
        username,
      });
    }

    let showRepositoryStats = !shouldRenderLeetCode;

    // Apply the viewer's OAuth token (when present) so private repositories
    // and private contributions are included for their own account.
    const userToken = await resolveUserToken(req, username);

    // Fetch all user data sources in parallel
    const [
      githubResult,
      contributionResult,
      leetcodeResult,
      codeforcesResult,
      codechefResult,
    ] = await Promise.all([
      getGitHubUserData(username, userToken),
      getContributionData(username, null, userToken), // Fetches userCreatedAt inside the service when needed
      shouldRenderLeetCode ? getLeetCodeData(leetcode) : null,
      codeforces ? getCodeforcesData(codeforces) : null,
      codechef ? getCodeChefData(codechef) : null,
    ]);

    if (!githubResult.success) {
      return sendGracefulErrorSvg(res, {
        code: githubResult.code || GitHubErrorCode.API_ERROR,
        username,
        detail: githubResult.error,
      });
    }
    const { data } = githubResult;

    const contributionData = contributionResult.success ? contributionResult.data : null;
    const leetcodeData = leetcodeResult?.success ? leetcodeResult.data : null;
    if (shouldRenderLeetCode && !leetcodeData) {
      showRepositoryStats = true;
    }
    const codeforcesData = codeforcesResult?.success ? codeforcesResult.data : null;
    const codechefData = codechefResult?.success ? codechefResult.data : null;

    const cpPlatforms = [
      shouldRenderLeetCode ? leetcodeData : null,
      codeforcesData,
      codechefData,
    ].filter(Boolean).length;

    const showCPSection = cpPlatforms >= 2;

    const activityStats = [
      { label: 'Contributions', value: contributionData ? formatNumber(contributionData.totalContributions) : '-' },
      { label: 'PRs Opened', value: contributionData ? formatNumber(contributionData.totalPRs) : '-' },
      { label: 'Issues Opened', value: contributionData ? formatNumber(contributionData.totalIssues) : '-' },
    ];

    const streakStats = [
      { label: 'Current', value: contributionData ? formatNumber(contributionData.currentStreak) : '-' },
      { label: 'Longest', value: contributionData ? formatNumber(contributionData.longestStreak) : '-' },
      { label: 'Total', value: contributionData ? formatNumber(contributionData.totalContributionDays) : '-' },
    ];

    let card3Title;
    let card3Stats;

    const rawDomainInsights = typeof activeTheme.domainConfig?.calculateInsights === 'function'
      ? activeTheme.domainConfig.calculateInsights(data.repos)
      : null;

    // Only use domain insights when they actually carry data, so non-domain
    // users don't get a card full of zeros ("0% / 0 / Inactive").
    const domainInsights = rawDomainInsights
      && Array.isArray(rawDomainInsights.stats)
      && rawDomainInsights.stats.some((stat) => {
        const value = String(stat.value ?? '').trim().toLowerCase();
        return value !== '' && !['0', '0%', '-', 'inactive', 'n/a'].includes(value);
      })
      ? rawDomainInsights
      : null;

    if (!codeforcesData && !codechefData) {
      if (showRepositoryStats) {
        if (domainInsights) {
          card3Title = domainInsights.title;
          card3Stats = domainInsights.stats;
        } else {
          card3Title = 'Repository Stats';
          card3Stats = [
            { label: 'Repositories', value: formatNumber(data.totalRepos ?? data.publicRepos) },
            { label: 'Stars', value: formatNumber(data.totalStars) },
            { label: 'Followers', value: formatNumber(data.followers) },
          ];
        }
      } else {
        const getRatingOrRanking = () => {
          if (!leetcodeData) return { label: 'Rating', value: '-' };
          if (leetcodeData.contestRating) return { label: 'Rating', value: String(leetcodeData.contestRating) };
          return { label: 'Rank', value: formatNumber(leetcodeData.ranking) };
        };
        const getEMHStats = () => {
          if (!leetcodeData) return { label: 'E/M/H', value: '-', isVertical: false };
          return {
            label: 'E/M/H',
            isVertical: true,
            easy: leetcodeData.easySolved,
            medium: leetcodeData.mediumSolved,
            hard: leetcodeData.hardSolved,
          };
        };
        card3Title = leetcodeData ? 'LeetCode Stats' : 'Competitive Coding';
        card3Stats = [
          { label: 'Solved', value: leetcodeData ? formatNumber(leetcodeData.totalSolved) : '-' },
          getEMHStats(),
          getRatingOrRanking(),
        ];
      }
    } else if (!showCPSection) {
      if (codeforcesData) {
        const rankShort = CF_RANK_MAP[codeforcesData.rank?.toLowerCase()] ?? codeforcesData.rank ?? 'unrated';
        card3Title = 'Codeforces Stats';
        card3Stats = [
          { label: 'Rating', value: String(codeforcesData.rating) },
          { label: 'Rank', value: rankShort },
          { label: 'Max Rating', value: String(codeforcesData.maxRating) },
        ];
      } else {
        card3Title = 'CodeChef Stats';
        card3Stats = [
          { label: 'Rating', value: String(codechefData.currentRating) },
          { label: 'Stars', value: codechefData.stars },
          { label: 'Division', value: codechefData.division ?? 'Div 4' },
        ];
      }
    } else if (domainInsights) {
      card3Title = domainInsights.title;
      card3Stats = domainInsights.stats;
    } else {
      card3Title = 'Repository Stats';
      card3Stats = [
        { label: 'Repositories', value: formatNumber(data.totalRepos ?? data.publicRepos) },
        { label: 'Stars', value: formatNumber(data.totalStars) },
        { label: 'Followers', value: formatNumber(data.followers) },
      ];
    }

    let chartData;
    if (contributionData && contributionData.days && contributionData.days.length > 0) {
      const recentDays = contributionData.days.slice(-30);
      chartData = recentDays.map(day => day.count);
    } else {
      // Do not fall back to randomly generated data when the GitHub GraphQL
      // API is unavailable. Embedding fake contribution bars in a README
      // misleads viewers into believing they represent real activity.
      // Use zeroed-out bars instead so the chart is visually consistent but
      // clearly reflects that no data is available.
      chartData = Array(30).fill(0);
    }

    const topLanguages = getTopLanguages(data?.repos ?? [], 5);

    if (topLanguages.length === 0) {
      topLanguages.push({
        label: 'No Data',
        value: 1,
      });
    }

    const trophyData = {
      commits: Number(contributionData?.totalContributions) || 0,
      prs: Number(contributionData?.totalPRs) || 0,
      issues: Number(contributionData?.totalIssues) || 0,
      repos: Number(data?.totalRepos ?? data?.publicRepos) || 0,
      stars: Number(data?.totalStars) || 0,
      followers: Number(data?.followers) || 0,
      reviews: Number(contributionData?.totalReviews) || 0,
      contributedRepos: Number(contributionData?.contributedRepos) || 0,
      forks: Number(contributionData?.forkedRepos) || 0,
      discussions: Number(contributionData?.discussions) || 0,
    };

    const totalLangValue = topLanguages.reduce((sum, item) => sum + item.value, 0);
    const languagesWithPct = topLanguages.map(item => ({
      label: item.label,
      percentage: totalLangValue ? Math.round((item.value / totalLangValue) * 100) : 0,
    }));

    const accessibility = buildDashboardAccessibility({
      username,
      contributions: contributionData ? contributionData.totalContributions : 0,
      prs: contributionData ? contributionData.totalPRs : 0,
      issues: contributionData ? contributionData.totalIssues : 0,
      currentStreak: contributionData ? contributionData.currentStreak : 0,
      longestStreak: contributionData ? contributionData.longestStreak : 0,
      languages: languagesWithPct,
      trophies: trophyData,
    });

    const { content, width, height } = renderDashboard({
      user: {
        title: `${data.name || username}'s Dashboard`,
        subtitle: data.bio
          ? (data.bio.length > 60 ? data.bio.slice(0, 60) + '...' : data.bio)
          : `@${username}`,
        avatarUrl: data.avatarDataUri || data.avatarUrl,
        handle: username,
      },
      align,
      activityStats,
      streakStats,
      thirdCard: { title: card3Title, stats: card3Stats },
      contributionData: chartData,
      topLanguages,
      trophyData,
      cp: {
        leetcode: shouldRenderLeetCode ? leetcodeData : null,
        codeforces: codeforcesData,
        codechef: codechefData,
      },
      showCPSection,
      sections,
      style,
    });

    const svg = wrapSvg(content, width, height, accessibility);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400, stale-if-error=86400');
    res.send(svg);
  } catch (error) {
    console.error('Profile render failed:', error.message);
    return sendGracefulErrorSvg(res, {
      code: GitHubErrorCode.API_ERROR,
      username: typeof req.query.username === 'string' ? req.query.username : undefined,
      detail: error.message,
    });
  }
});

// Loading spinner endpoint
router.get('/loading', (req, res) => {
  const { theme, customThemeOverrides } = normalizeProfileQuery(req.query);
  let activeTheme = setTheme(theme);
  if (customThemeOverrides && Object.keys(customThemeOverrides).length > 0) {
    const hybridTheme = createHybridTheme(activeTheme, customThemeOverrides);
    activeTheme = setTheme(hybridTheme);
  }
  return sendLoadingSpinner(res);
});

export default router;
