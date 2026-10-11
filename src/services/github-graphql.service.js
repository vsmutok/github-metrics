// GitHub GraphQL API Service - Contribution Calendar & Streaks

import { githubCache } from "../utils/cache.js";
import { loadConfig } from "../config/index.js";
import { HttpErrorCode, httpRequest } from "../utils/http-client.js";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

/* authorization headers for GraphQL API*/
function getHeaders() {
  const config = loadConfig();
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "github-metrics",
  };

  if (config.github.token) {
    headers["Authorization"] = `Bearer ${config.github.token}`;
  }

  return headers;
}

/* GraphQL query for contribution calendar and additional stats */
const CONTRIBUTION_QUERY = `
query($username: String!, $discussionQuery: String!) {
  user(login: $username) {
    createdAt
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
    repositoriesContributedTo(first: 1, includeUserRepositories: false, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, PULL_REQUEST_REVIEW]) {
      totalCount
    }
    forkedRepositories: repositories(first: 1, ownerAffiliations: OWNER, isFork: true) {
      totalCount
    }
    pullRequests(states: MERGED) {
      totalCount
    }
    issues(states: CLOSED) {
      totalCount
    }
  }
  discussionSearch: search(query: $discussionQuery, type: DISCUSSION, first: 1) {
    discussionCount
  }
}
`;

/* fetch contribution data from GitHub GraphQL API */
async function fetchContributionData(username) {
  if (!loadConfig().github.enabled) {
    throw new Error("GITHUB_TOKEN required for contribution data");
  }

  const response = await httpRequest(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      query: CONTRIBUTION_QUERY,
      variables: { username, discussionQuery: `author:${username}` },
    }),
  });

  if (!response.success) {
    if (response.error?.code === HttpErrorCode.TIMEOUT) {
      throw new Error("GitHub GraphQL API timeout");
    }
    if (response.error?.code === HttpErrorCode.INVALID_JSON) {
      throw new Error("GitHub GraphQL API returned invalid JSON");
    }
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub API rate limit exceeded");
    }
    throw new Error(`GitHub GraphQL API error: ${response.status || 0}`);
  }

  // handles rate limits silently
  const rateLimitRemaining = response.headers?.get("x-ratelimit-remaining");
  if (rateLimitRemaining && parseInt(rateLimitRemaining, 10) < 10) {
    // rate limit warning suppressed for production
  }

  const json = response.data;

  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query failed");
  }

  const user = json.data?.user;
  if (user && json.data?.discussionSearch) {
    user.discussionSearch = json.data.discussionSearch;
  }

  return user;
}

/* flatten contribution calendar weeks into a sorted array of days */
function flattenContributionDays(calendar) {
  if (!calendar?.weeks) return [];

  const days = [];
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      days.push({
        date: day.date,
        count: day.contributionCount,
      });
    }
  }

  // sort by date ascending
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

/* calculate current streak (consecutive days with contributions ending today or yesterday) */
function calculateCurrentStreak(days) {
  if (days.length === 0) return 0;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let streak = 0;
  let foundStart = false;

  // backwards from most recent day
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];

    // counts only if today or yesterday has contributions
    if (!foundStart) {
      if (day.date === today || day.date === yesterday) {
        if (day.count > 0) {
          foundStart = true;
          streak = 1;
        } else if (day.date === today) {
          // today has no contributions, check yesterday
          continue;
        } else {
          // yesterday has no contributions, streak is 0
          break;
        }
      }
      continue;
    }

    // continues counting consecutive days
    if (day.count > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/* longest streak in the contribution history */
function calculateLongestStreak(days) {
  if (days.length === 0) return 0;

  let longest = 0;
  let current = 0;

  for (const day of days) {
    if (day.count > 0) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

/* calculate total contribution days */
function calculateTotalContributionDays(days) {
  return days.filter((day) => day.count > 0).length;
}

/* normalize contribution data into a clean object */
function normalizeContributionData(userData) {
  const collection = userData?.contributionsCollection;
  const calendar = collection?.contributionCalendar;
  const days = flattenContributionDays(calendar);

  return {
    totalContributions: calendar?.totalContributions || 0,
    currentStreak: calculateCurrentStreak(days),
    longestStreak: calculateLongestStreak(days),
    totalContributionDays: calculateTotalContributionDays(days),
    totalCommits: collection?.totalCommitContributions || 0,
    totalPRs: collection?.totalPullRequestContributions || 0,
    totalReviews: collection?.totalPullRequestReviewContributions || 0,
    totalIssues: collection?.totalIssueContributions || 0,
    contributedRepos: userData?.repositoriesContributedTo?.totalCount || 0,
    forkedRepos: userData?.forkedRepositories?.totalCount || 0,
    discussions: userData?.discussionSearch?.discussionCount || 0,
    prsMerged: userData?.pullRequests?.totalCount || 0,
    issuesClosed: userData?.issues?.totalCount || 0,
    days,
  };
}

/* Fetch calendars for all years using dynamic aliases */
async function fetchAllYearsData(username, startYear, endYear) {
  let queryFields = "";
  const currentIso = new Date().toISOString();
  for (let y = startYear; y <= endYear; y++) {
    const toDate = y === endYear ? currentIso : `${y}-12-31T23:59:59Z`;
    queryFields += `
      y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${toDate}") {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    `;
  }

  const query = `
    query($username: String!) {
      user(login: $username) {
        ${queryFields}
      }
    }
  `;

  const response = await httpRequest(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      query,
      variables: { username },
    }),
  });

  if (!response.success) {
    throw new Error(`GitHub GraphQL API error when fetching multi-year data: ${response.status || 0}`);
  }

  const json = response.data;
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query for multi-year data failed");
  }

  return json.data?.user;
}

/* normalize multi-year contribution data */
function normalizeMultiYearData(userData, initialUserData, startYear, currentYear) {
  let totalContributions = 0;
  let totalCommits = 0;
  let totalPRs = 0;
  let totalReviews = 0;
  let totalIssues = 0;
  let allDays = [];

  for (let y = startYear; y <= currentYear; y++) {
    const collection = userData[`y${y}`];
    if (!collection) continue;

    totalCommits += collection.totalCommitContributions || 0;
    totalPRs += collection.totalPullRequestContributions || 0;
    totalReviews += collection.totalPullRequestReviewContributions || 0;
    totalIssues += collection.totalIssueContributions || 0;

    const calendar = collection.contributionCalendar;
    if (calendar) {
      totalContributions += calendar.totalContributions || 0;
      const days = flattenContributionDays(calendar);
      allDays.push(...days);
    }
  }

  // sort days to ensure chronological order for streak calculation
  allDays.sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalContributions,
    currentStreak: calculateCurrentStreak(allDays),
    longestStreak: calculateLongestStreak(allDays),
    totalContributionDays: calculateTotalContributionDays(allDays),
    totalCommits,
    totalPRs,
    totalReviews,
    totalIssues,
    contributedRepos: initialUserData?.repositoriesContributedTo?.totalCount || 0,
    forkedRepos: initialUserData?.forkedRepositories?.totalCount || 0,
    discussions: initialUserData?.discussionSearch?.discussionCount || 0,
    prsMerged: initialUserData?.pullRequests?.totalCount || 0,
    issuesClosed: initialUserData?.issues?.totalCount || 0,
    days: allDays,
  };
}

/* fetch JSON with a timeout (used by the tokenless fallback) */
async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'github-metrics' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/* total count of authored PRs / issues via the public search API */
async function fetchSearchTotal(username, type) {
  try {
    const data = await fetchJsonWithTimeout(
      `https://api.github.com/search/issues?q=author:${encodeURIComponent(username)}+type:${type}&per_page=1`
    );
    return Number(data.total_count) || 0;
  } catch (error) {
    return 0;
  }
}

/* Build contribution data from public sources when no token is configured. */
async function fetchPublicContributionData(username) {
  const data = await fetchJsonWithTimeout(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=all`
  );

  const today = new Date().toISOString().split('T')[0];
  const days = (Array.isArray(data.contributions) ? data.contributions : [])
    .filter((day) => day && day.date && day.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({ date: day.date, count: Number(day.count) || 0 }));

  if (days.length === 0) {
    throw new Error('No public contribution data available');
  }

  const byYear = data.total && typeof data.total === 'object' ? data.total : null;
  const totalContributions = byYear
    ? Object.values(byYear).reduce((sum, value) => sum + (Number(value) || 0), 0)
    : days.reduce((sum, day) => sum + day.count, 0);

  const [prs, issues] = await Promise.all([
    fetchSearchTotal(username, 'pr'),
    fetchSearchTotal(username, 'issue'),
  ]);

  return {
    totalContributions,
    currentStreak: calculateCurrentStreak(days),
    longestStreak: calculateLongestStreak(days),
    totalContributionDays: calculateTotalContributionDays(days),
    totalCommits: 0,
    totalPRs: prs,
    totalReviews: 0,
    totalIssues: issues,
    contributedRepos: 0,
    forkedRepos: 0,
    discussions: 0,
    prsMerged: 0,
    issuesClosed: 0,
    days,
  };
}

/* fetch and normalize contribution data for a user */
export async function getContributionData(username, createdAt = null) {
  const cacheKey = `contributions:${username}`;

  // check cache first
  const cached = githubCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Without a GitHub token, fall back to public data sources so the card still
  // renders real contributions instead of empty placeholders.
  if (!loadConfig().github.enabled) {
    try {
      const resultData = await fetchPublicContributionData(username);
      const result = { success: true, data: resultData };
      githubCache.set(cacheKey, result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch public contribution data',
      };
    }
  }

  try {
    const userData = await fetchContributionData(username);

    if (!userData) {
      return {
        success: false,
        error: "User not found or no contribution data",
      };
    }

    const userCreatedAt = createdAt || userData.createdAt;
    const currentYear = new Date().getFullYear();
    const startYear = userCreatedAt ? new Date(userCreatedAt).getFullYear() : null;

    let resultData;

    // if the user has contribution history in previous years, fetch them
    if (userCreatedAt && startYear && startYear < currentYear) {
      const multiYearData = await fetchAllYearsData(username, startYear, currentYear);
      resultData = normalizeMultiYearData(multiYearData, userData, startYear, currentYear);
    } else {
      resultData = normalizeContributionData(userData);
    }

    const result = {
      success: true,
      data: resultData,
    };

    // store in cache
    githubCache.set(cacheKey, result);

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to fetch contribution data",
    };
  }
}
