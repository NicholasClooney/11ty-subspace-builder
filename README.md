# 11ty Subspace Builder

A warp-speed Eleventy blog starter powered by Tachyons utility classes. It ships with theme switching, accessible navigation, and a flexible layout that adapts to small and large viewports.

## Features

- Powered by Eleventy 3 with Markdown-it and auto-generated heading anchors
- Tachyons-based, theme-aware typography and color palettes with preview buttons
- Recursive Eleventy Navigation sidebar with responsive hamburger toggle
- Reusable post list macro that trims excerpts and formats dates
- Responsive image pipeline powered by `@11ty/eleventy-img` (see [Responsive Images with Eleventy Img](posts/responsive-images-eleventy-img.md))
- YAML-driven site metadata, theme presets, and animation timing controls

## Quick Start

### Prerequisites

- Node.js 18 or newer

### Installation

```bash
npm install
```

### Local development

```bash
npm run dev
```

This sets `ELEVENTY_ENV=development` and starts Eleventy in watch/serve mode. Visit `http://localhost:8080` (default) to browse the site. Theme selections persist in `localStorage` so you can preview skins as you work.

### Local production preview

```bash
npm run prod
```

Runs the site with `ELEVENTY_ENV=production` while keeping Eleventy’s dev server running so you can QA the published experience without deploying.

### Production build

```bash
npm run build
```

This sets `ELEVENTY_ENV=production` and writes the static output to the `_site/` directory. Deploy those files to any static host or CDN.

## Social Preview Images

- `scripts/generate-og-images.js` runs before each Eleventy build to produce 1200×630 Open Graph cards using Satori (HTML template) and Resvg. We stick with Satori’s HTML helper instead of JSX so the pipeline stays zero-transpile and works out-of-the-box in Node.
- Templates blend Lexend (heading) + Inter (body) from the `@fontsource/*` packages and use the Sun theme palette (soft yellow gradient, amber accents, black typography); tweak `buildTemplate` to adjust the look.
- Headlines/excerpts auto-resize and truncate when needed so long titles (e.g. “The Joy (and Frustrations) of Building Small Sites with GPT-5 Codex”) stay legible without breaking the layout.
- Content hashing keeps regeneration cheap—changes to a post’s title, excerpt, or the template version trigger a refresh, otherwise cached PNGs in `.cache/og/` are reused.
- Use `npm run og` to generate cards manually, `npm run og -- --force` (or `OG_FORCE=true npx @11ty/eleventy`) to rebuild everything, and check the emitted file map in `_data/ogImages.json`.
- Posts automatically receive an `ogImage` field via computed data, so layouts and feeds can reference `{{ ogImage }}` without manual front matter tweaks.

## Project Structure

- `_data/` - Global data files (`site.yaml` and `themes.yaml`) that drive metadata, theme options, and animation settings.
- `_includes/layouts/` - Base and page layouts, including the responsive navigation + theme selector UI in `home.njk`.
- `_includes/components/` - Shareable Nunjucks macros like `post-list.njk` for rendering excerpts.
- `posts/` - Blog posts and collection defaults (`posts.json` assigns the home layout to the collection).
- `eleventy.config.js` - Eleventy configuration, Markdown-it setup, the Eleventy Img transform, and custom filters (`readableDate`, `machineDate`, `excerpt`).
- `index.md` - Home page content that also uses the `home` layout.

## Configuration

### Site settings (`_data/site.yaml`)

- `title`, `url`, and author contact details.
- `theme` block toggles the selector (`showSelectors`), controls animation timings, and sets the default theme (`defaultId`).

### Comments (`giscus`)

- Giscus is optional and configured via the `giscus` block in `_data/site.yaml`.
- Visit [giscus.app](https://giscus.app/) with your GitHub repository selected to generate the `repo`, `repoId`, `category`, and `categoryId` values—replace the defaults before enabling comments on your site.
- If you do not plan to use Giscus, delete or comment out the `giscus` block so any clones of this starter do not point comment traffic at someone else’s repository.
- The remaining attributes (`mapping`, `lang`, etc.) can stay at their defaults unless you want to tweak how threads are created or which language the widget uses.

### Theme presets (`_data/themes.yaml`)

Add, remove, or tweak Tachyons class pairs here. Each theme entry accepts:

- `id` - Unique identifier used for persistence and data attributes.
- `classes` - Tachyons classes applied to `html` when the theme is active.
- `midtoneClass` - Optional class used to recolor elements tagged with `.theme-midtone`.

## Writing Content

Create a new Markdown file in `posts/` with front matter similar to:

```markdown
---
title: My Next Adventure
date: 2025-02-01
eleventyNavigation:
  key: my-next-adventure
  parent: posts
excerpt: |
  A quick teaser paragraph that appears in post lists.
---

Your post content starts here. Eleventy handles Markdown -> HTML conversion.
```

Posts automatically pick up the layout defined in `posts/posts.json`. The `excerpt` field is optional; without it, the `excerpt` filter trims the rendered HTML.

## Components & Enhancements

- Use `{% from "components/post-list.njk" import renderPostList %}` inside a template to render a list of collection items with consistent styling.
- The `home.njk` layout wraps page content in a `<heading-anchors>` element to enable anchored headings and theme-aware typography.

## Deployment Tips

- Set `ELEVENTY_ENV=production` when building for production to leverage Eleventy’s environment-based defaults.
- Because Tachyons is loaded from a CDN, ensure outbound requests are allowed by your host or replace the `<link>` in `base.njk` with a bundled stylesheet.

## FAQ

### Why does the homepage say "No posts published yet" even though posts exist?

The home page runs `renderPostList(collections.posts, ...)` and Eleventy only adds templates to `collections.posts` when they are tagged `posts`. Make sure your post defaults include `"tags": ["posts"]`—for example, set it once in `posts/posts.json` so every Markdown file under `posts/` inherits the tag.

### Why are posts ordered oldest-first?

Eleventy builds `collections.posts` in ascending date order by default (oldest first). The homepage reverses that list inside `renderPostList`, but any other consumer—like the navigation tree fed by `collections.all | eleventyNavigation`—will keep the oldest-first ordering unless you reverse it or define a custom collection that sorts newest-to-oldest.

## License

MIT License - see [`LICENSE`](LICENSE).
