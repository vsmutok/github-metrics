# Contributing to github-metrics

Thanks for your interest in improving **github-metrics**.

Bug fixes, UI polish, new themes, documentation improvements, and renderer
refactors are all welcome.

---

## Before you start

- Search existing issues before opening a new one.
- Keep pull requests focused on a single issue.
- Discuss large feature or design changes before implementing them.
- Test your changes locally before opening a PR.
- Follow the existing visual language and code conventions.

---

## Local development setup

### 1. Fork and clone

```bash
git clone https://github.com/vsmutok/github-metrics.git
cd github-metrics
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the environment file

```bash
cp .env.example .env
```

Set at least a GitHub token to avoid strict API rate limits:

```env
GITHUB_TOKEN=ghp_your_token_here
```

### 4. Start the development server

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## Project structure

```text
src/
├── routes/       # Express routes
├── services/     # External platform integrations
├── renderers/    # SVG rendering logic
├── themes/       # Dashboard color palettes
├── utils/        # Shared helpers (cache, validation, sanitizers)
└── server.js     # Express entry point
```

---

## Contribution guidelines

### UI and design

The project favors a clean, modern aesthetic:

- GitHub's official palettes are the defaults (`github-dark`, `github-light`, `github-dimmed`).
- Soft gradients and minimal visual noise.
- Compact but readable layout.

When working on UI:

- Preserve spacing consistency.
- Avoid overcrowding sections.
- Keep typography readable.
- Match the existing visual language.
- Keep markup responsive.

For major redesigns, share a mockup or screenshot before implementing.

### SVG renderer

The renderer is the core of the project. Please ensure:

- All dynamic content is passed through the existing sanitizers.
- SVG attributes are valid.
- Text overflow is handled.
- Layout stays balanced across themes.
- New sections scale correctly at smaller widths.

Avoid unnecessary SVG complexity.

### Themes

- Add one file per theme under `src/themes/` and register it in
  `src/renderers/svg.renderer.js`.
- Every theme must define the full color contract (backgrounds, borders, text,
  accents, gradients, status colors) and a non-empty `chartColors` array.
- Run `npm run previews` to regenerate preview SVGs.

---

## Commit message style

```bash
feat: add reviews trophy
fix: resolve navbar mobile overflow
refactor: simplify theme renderer
style: improve contribution graph spacing
```

---

## Pull request guidelines

Before opening a PR:

- Confirm the app runs locally.
- Run `npm run check` and fix any reported issues.
- Test responsive behavior for UI changes.
- Attach screenshots for visual changes.
- Keep the description clear and link the related issue.

---

## Code style

- Keep code modular and readable.
- Reuse existing utilities.
- Avoid large monolithic renderer functions.
- Prefer small, reusable helpers.
- Do not add comments unless they clarify non-obvious behavior.

---

## Reporting security issues

If you discover a security issue or an SVG injection vector, do not open a
public issue. Contact the maintainers privately first.

---

## Community

Be respectful and constructive. Open source works best when contributors
collaborate with clarity and kindness.

Thanks for contributing.
