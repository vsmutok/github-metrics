// github-metrics — studio
// Renders the dashboard entirely in the browser using the shared engine, so the
// preview works on static hosting (GitHub Pages) as well as the dynamic server.

import {
  setTheme,
  renderDashboardSvg,
  buildDemoModel,
  DEMO_PROFILE,
  DASHBOARD_SECTIONS,
} from './engine/index.js';

const DEFAULT_THEME = 'github-dark';
const DEFAULT_USERNAME = 'vsmutok';
const THEME_KEY = 'gm-theme';

const DEFAULT_SECTIONS = Object.fromEntries(DASHBOARD_SECTIONS.map((key) => [key, true]));

const SECTION_HIDE_PARAM = {
  header: 'hide_header',
  activity: 'hide_activity',
  streak: 'hide_streak',
  repos: 'hide_repos',
  contribution: 'hide_contribution',
  languages: 'hide_languages',
  trophies: 'hide_trophies',
};

const els = {
  username: document.getElementById('username'),
  theme: document.getElementById('theme'),
  style: document.getElementById('style'),
  sections: document.getElementById('sections'),
  stage: document.getElementById('previewStage'),
  meta: document.getElementById('previewMeta'),
  snippet: document.getElementById('codeSnippet'),
  hint: document.getElementById('codeHint'),
  copy: document.getElementById('copyBtn'),
  reset: document.getElementById('resetBtn'),
  downloadSvg: document.getElementById('downloadSvg'),
  downloadPng: document.getElementById('downloadPng'),
  themeToggle: document.getElementById('themeToggle'),
  chips: document.querySelectorAll('.chip'),
  tabs: document.querySelectorAll('.tab'),
};

const state = {
  username: DEFAULT_USERNAME,
  theme: DEFAULT_THEME,
  style: 'classic',
  align: 'left',
  sections: { ...DEFAULT_SECTIONS },
  tab: 'markdown',
};

let liveProfile = null; // cached live profile for the current username
let debounceTimer = null;

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

function currentAlign() {
  const checked = document.querySelector('input[name="align"]:checked');
  return checked ? checked.value : 'left';
}

function readSections() {
  const sections = {};
  els.sections.querySelectorAll('input[data-section]').forEach((input) => {
    sections[input.dataset.section] = input.checked;
  });
  return sections;
}

function repoLanguages(repos) {
  const counts = {};
  repos.forEach((repo) => {
    if (repo && typeof repo.language === 'string' && repo.language.trim()) {
      counts[repo.language] = (counts[repo.language] || 0) + 1;
    }
  });
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

// Contribution calendar is not exposed by the GitHub REST API. The community
// endpoint below serves the same public data over CORS so the static studio can
// show a real all-time contribution chart for any username.
async function fetchContributions(username) {
  const empty = { total: 0, current: 0, longest: 0, activeDays: 0, last30: Array(30).fill(0) };
  try {
    const res = await fetch(
      `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=all`
    );
    if (!res.ok) return empty;
    const data = await res.json();

    // The all-time payload includes the full current year (future days are 0),
    // so trim to today before computing streaks and the 30-day chart.
    const today = new Date().toISOString().slice(0, 10);
    const days = (Array.isArray(data.contributions) ? data.contributions : [])
      .filter((day) => day && day.date && day.date <= today)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const counts = days.map((day) => Number(day.count) || 0);
    if (counts.length === 0) return empty;

    let longest = 0;
    let run = 0;
    for (const count of counts) {
      if (count > 0) { run += 1; if (run > longest) longest = run; }
      else run = 0;
    }

    // An ongoing streak still counts if today has no activity yet.
    let end = counts.length - 1;
    if (counts[end] === 0) end -= 1;
    let current = 0;
    for (let i = end; i >= 0; i -= 1) {
      if (counts[i] > 0) current += 1;
      else break;
    }

    const totalByYear = data.total && typeof data.total === 'object' ? data.total : null;
    const total = totalByYear
      ? Object.values(totalByYear).reduce((sum, value) => sum + (Number(value) || 0), 0)
      : counts.reduce((sum, value) => sum + value, 0);

    return {
      total,
      current,
      longest,
      activeDays: counts.filter((count) => count > 0).length,
      last30: counts.slice(-30),
    };
  } catch (error) {
    return empty;
  }
}

async function fetchSearchCounts(username) {
  const url = (type) =>
    `https://api.github.com/search/issues?q=author:${encodeURIComponent(username)}+type:${type}&per_page=1`;
  try {
    const [prRes, issueRes] = await Promise.all([fetch(url('pr')), fetch(url('issue'))]);
    const prs = prRes.ok ? (await prRes.json()).total_count || 0 : 0;
    const issues = issueRes.ok ? (await issueRes.json()).total_count || 0 : 0;
    return { prs, issues };
  } catch (error) {
    return { prs: 0, issues: 0 };
  }
}

async function fetchLiveProfile(username) {
  const headers = { Accept: 'application/vnd.github+json' };
  const [userRes, reposRes, contribution, searchCounts] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { headers }),
    fetchContributions(username),
    fetchSearchCounts(username),
  ]);
  if (!userRes.ok) throw new Error('user not found');
  const user = await userRes.json();
  const repos = reposRes.ok ? await reposRes.json() : [];
  const stars = Array.isArray(repos)
    ? repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0)
    : 0;
  const languages = Array.isArray(repos) ? repoLanguages(repos) : [];
  if (languages.length === 0) languages.push({ label: 'No Data', value: 1 });
  const forks = Array.isArray(repos) ? repos.filter((repo) => repo.fork).length : 0;

  return {
    username,
    name: user.name || username,
    subtitle: user.bio ? (user.bio.length > 60 ? user.bio.slice(0, 60) + '...' : user.bio) : `@${username}`,
    avatarUrl: user.avatar_url,
    activity: { contributions: contribution.total, prs: searchCounts.prs, issues: searchCounts.issues },
    streak: {
      current: contribution.current,
      longest: contribution.longest,
      total: contribution.activeDays,
    },
    repository: { repositories: user.public_repos || 0, stars, followers: user.followers || 0 },
    languages,
    contributions: contribution.last30,
    trophies: {
      commits: contribution.total,
      prs: searchCounts.prs,
      issues: searchCounts.issues,
      repos: user.public_repos || 0,
      stars,
      followers: user.followers || 0,
      reviews: 0,
      contributedRepos: 0,
      forks,
      discussions: 0,
    },
  };
}

function activeProfile() {
  if (state.username.toLowerCase() === DEMO_PROFILE.username) {
    return DEMO_PROFILE;
  }
  return liveProfile || {
    ...DEMO_PROFILE,
    username: state.username,
    name: state.username,
    subtitle: `@${state.username}`,
  };
}

function renderPreview() {
  setTheme(state.theme);
  const model = buildDemoModel(activeProfile(), {
    align: state.align,
    sections: state.sections,
    formatNumber,
  });
  model.style = state.style;
  const svg = renderDashboardSvg(model);
  els.stage.innerHTML = svg;
  els.meta.textContent = `${state.username} · ${state.theme}`;
}

function baseUrl() {
  return window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set('username', state.username);
  if (state.theme !== DEFAULT_THEME) params.set('theme', state.theme);
  if (state.style !== 'classic') params.set('style', state.style);
  if (state.align !== 'left') params.set('align', state.align);
  DASHBOARD_SECTIONS.forEach((key) => {
    if (!state.sections[key]) params.set(SECTION_HIDE_PARAM[key], 'true');
  });
  return params.toString();
}

function buildEmbed() {
  const siteBase = baseUrl();
  const isGithubPages = window.location.hostname.endsWith('github.io');
  const allSectionsOn = DASHBOARD_SECTIONS.every((key) => state.sections[key]);
  const useStatic = isGithubPages && allSectionsOn && state.align === 'left';

  const url = useStatic
    ? `${siteBase}/previews/${state.theme}.svg`
    : `${siteBase}/api/profile?${buildQuery()}`;

  return { url, useStatic, isGithubPages };
}

function renderSnippet() {
  const { url, useStatic, isGithubPages } = buildEmbed();
  let text;
  if (state.tab === 'markdown') {
    text = `![github-metrics](${url})`;
  } else if (state.tab === 'html') {
    text = `<img src="${url}" alt="GitHub profile metrics" width="960" />`;
  } else {
    text = url;
  }
  els.snippet.textContent = text;

  if (useStatic) {
    els.hint.textContent = 'Static GitHub Pages preview (shows all sections).';
  } else if (isGithubPages) {
    els.hint.textContent = 'GitHub Pages cannot run the API — host it (see README) so live, per-user cards work.';
  } else {
    els.hint.textContent = 'Served by this self-hosted instance.';
  }
}

function renderAll() {
  renderPreview();
  renderSnippet();
}

async function refreshForUsername() {
  const username = state.username;
  if (username.toLowerCase() === DEMO_PROFILE.username) {
    liveProfile = null;
    renderAll();
    return;
  }
  try {
    liveProfile = await fetchLiveProfile(username);
  } catch (error) {
    liveProfile = null;
  }
  renderAll();
}

/* ---------- Events ---------- */
els.username.addEventListener('input', () => {
  state.username = els.username.value.trim() || DEFAULT_USERNAME;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshForUsername, 500);
});

els.theme.addEventListener('change', () => {
  state.theme = els.theme.value;
  themeTouched = true;
  renderAll();
});

els.style.addEventListener('change', () => {
  state.style = els.style.value;
  renderAll();
});

document.querySelectorAll('input[name="align"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    state.align = currentAlign();
    renderAll();
  });
});

els.sections.addEventListener('change', () => {
  state.sections = readSections();
  renderAll();
});

els.tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    els.tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.tab = tab.dataset.tab;
    renderSnippet();
  });
});

els.chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    els.chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    els.username.value = chip.dataset.user;
    state.username = chip.dataset.user;
    refreshForUsername();
  });
});

els.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(els.snippet.textContent.trim());
    els.copy.textContent = 'Copied';
    setTimeout(() => { els.copy.textContent = 'Copy'; }, 1500);
  } catch (error) {
    console.error('Copy failed:', error);
  }
});

els.reset.addEventListener('click', () => {
  state.username = DEFAULT_USERNAME;
  state.align = 'left';
  state.sections = { ...DEFAULT_SECTIONS };
  themeTouched = false;
  liveProfile = null;
  state.theme = cardThemeForSite(siteIsLight());
  state.style = 'classic';
  els.username.value = DEFAULT_USERNAME;
  els.theme.value = state.theme;
  if (els.style) els.style.value = 'classic';
  const left = document.querySelector('input[name="align"][value="left"]');
  if (left) left.checked = true;
  els.sections.querySelectorAll('input[data-section]').forEach((input) => {
    input.checked = true;
  });
  els.chips.forEach((c) => c.classList.toggle('active', c.dataset.user === DEFAULT_USERNAME));
  renderAll();
});

function download(filename, href) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = href;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function serializeSvg() {
  const svg = els.stage.querySelector('svg');
  if (!svg) return '';
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
}

els.downloadSvg.addEventListener('click', () => {
  const svg = serializeSvg();
  if (!svg) return;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  download(`${state.username}-metrics-${state.theme}.svg`, url);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

els.downloadPng.addEventListener('click', () => {
  const svg = serializeSvg();
  if (!svg) return;
  els.downloadPng.disabled = true;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    download(`${state.username}-metrics-${state.theme}.png`, canvas.toDataURL('image/png'));
    els.downloadPng.disabled = false;
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    els.downloadPng.disabled = false;
  };
  img.src = url;
});

/* ---------- Site theme (dark / light) ---------- */
let themeTouched = false;

function prefersLight() {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch (error) {
    return false;
  }
}

function storedSiteTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (error) {
    return null;
  }
}

function cardThemeForSite(isLight) {
  return isLight ? 'github-light' : 'github-dark';
}

function siteIsLight() {
  return document.documentElement.classList.contains('light');
}

function applySiteTheme(isLight, { persist = true, syncCard = true } = {}) {
  document.documentElement.classList.toggle('light', isLight);
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    } catch (error) { /* ignore */ }
  }
  if (syncCard && !themeTouched) {
    state.theme = cardThemeForSite(isLight);
    if (els.theme) els.theme.value = state.theme;
  }
  renderAll();
}

els.themeToggle.addEventListener('click', () => {
  applySiteTheme(!siteIsLight());
});

/* ---------- Init ---------- */
(function init() {
  const stored = storedSiteTheme();
  const isLight = stored ? stored === 'light' : prefersLight();
  applySiteTheme(isLight, { persist: false });

  // Follow the OS preference until the visitor picks a theme explicitly.
  try {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (event) => {
      if (!storedSiteTheme()) applySiteTheme(event.matches, { persist: false });
    };
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);
  } catch (error) { /* ignore */ }
})();
