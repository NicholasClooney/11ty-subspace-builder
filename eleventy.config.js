// 11ty Nav
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';
// 11ty Img
import { eleventyImageTransformPlugin } from '@11ty/eleventy-img';
import EleventyFetch from '@11ty/eleventy-fetch';
import hljs from 'highlight.js';
import path from 'node:path';

// Bake our own Markdown anchors
import MarkdownIt from 'markdown-it';
import MarkdownItAnchor from 'markdown-it-anchor';
import MarkdownItTocDoneRight from 'markdown-it-toc-done-right';
// Use yaml for data
import yaml from 'js-yaml';
import excerpt from './lib/excerpt.js';

const OG_FORCE_ENV = process.env.OG_FORCE === 'true';

const parseBlobUrl = (githubBlobUrl) => {
  const url = new URL(githubBlobUrl);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[2] !== 'blob') throw new Error('URL must be a GitHub blob URL');
  const [user, repo, , branch, ...fileParts] = parts;
  const filePath = fileParts.join('/');
  const rangeHash = (url.hash || '').replace(/^#/, '');
  let start = null;
  let end = null;
  if (rangeHash.startsWith('L')) {
    const [first, last] = rangeHash
      .split('-')
      .map((part) => part.replace(/^L/, ''));
    start = parseInt(first, 10);
    end = last ? parseInt(last, 10) : start;
  }
  const raw = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}`;
  return {
    user,
    repo,
    branch,
    filePath,
    raw,
    web: githubBlobUrl,
    start,
    end,
  };
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const trimSharedIndent = (value) => {
  if (typeof value !== 'string' || value.length === 0) return value;
  const lines = value.split('\n');
  let minIndent = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^[\t ]*/);
    const indentLength = match ? match[0].length : 0;
    if (indentLength === 0) {
      minIndent = 0;
      break;
    }
    minIndent =
      minIndent === null ? indentLength : Math.min(minIndent, indentLength);
  }

  if (!minIndent) return value;

  return lines
    .map((line) => {
      if (!line.trim()) return '';
      const match = line.match(/^[\t ]*/);
      const indentLength = match ? match[0].length : 0;
      if (indentLength === 0) return line;
      const remove = Math.min(indentLength, minIndent);
      return line.slice(remove);
    })
    .join('\n');
};

const guessLanguageByExt = (filePath) => {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const map = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'tsx',
    jsx: 'jsx',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
    zsh: 'bash',
    bash: 'bash',
    swift: 'swift',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    php: 'php',
    java: 'java',
    kt: 'kotlin',
    css: 'css',
    scss: 'scss',
    html: 'xml',
    xml: 'xml',
    md: 'markdown',
    txt: 'plaintext',
  };
  return map[ext] || 'plaintext';
};

const slugify = (value) =>
  encodeURIComponent(String(value).trim().toLowerCase().replace(/\s+/g, '-'));

const md = new MarkdownIt({ html: true, linkify: true })
  .use(MarkdownItAnchor, {
    slugify,
    permalink: MarkdownItAnchor.permalink.ariaHidden({
      class: 'header-anchor',
      placement: 'before',
    }),
  })
  .use(MarkdownItTocDoneRight, {
    containerClass: 'toc',
    listType: 'ul',
    level: [2, 3],
    slugify,
  });

export default function (eleventyConfig) {
  const shouldSkipHref = (href) => {
    if (!href) return true;
    const value = href.trim();
    if (!value) return true;
    if (value.startsWith('#')) return true;
    if (value.startsWith('mailto:')) return true;
    if (value.startsWith('tel:')) return true;
    if (value.startsWith('javascript:')) return true;
    if (value.startsWith('data:')) return true;
    if (value.startsWith('//')) return true;
    if (value.startsWith('http://')) return true;
    if (value.startsWith('https://')) return true;
    return false;
  };

  const hasFileExtension = (path) => {
    if (!path) return false;
    const segment = path.split('/').pop();
    if (!segment) return false;
    return segment.includes('.');
  };

  const normalizePath = (path) => {
    if (!path) return path;
    if (path !== '/' && path.endsWith('/')) return path.slice(0, -1);
    return path;
  };

  eleventyConfig.addDataExtension('yaml', (contents) => yaml.load(contents));

  eleventyConfig.addGlobalData('eleventyComputed', {
    eleventyExcludeFromCollections(data) {
      return data.draft && process.env.ELEVENTY_ENV === 'production';
    },
  });

  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ['avif', 'webp', 'jpeg'],
    widths: [320, 640, 960, 1280],
    htmlOptions: {
      imgAttributes: {
        loading: 'lazy',
        decoding: 'async',
        sizes: '(width <= 30em) 100vw, 75vw',
      },
      pictureAttributes: {},
    },
  });

  // Tell 11ty to use our custom Markdown-it
  eleventyConfig.setLibrary('md', md);

  // Copy static assets straight through to the build output
  eleventyConfig.addPassthroughCopy('assets');

  eleventyConfig.addAsyncShortcode(
    'github',
    async function (url, style = 'light') {
      const meta = parseBlobUrl(url);

      const fetched = await EleventyFetch(meta.raw, {
        duration: '1d',
        type: 'text',
      });
      const source = typeof fetched === 'string' ? fetched : String(fetched);

      let code = source;
      if (meta.start && meta.end) {
        const lines = source.split('\n');
        code = lines.slice(meta.start - 1, meta.end).join('\n');
      }
      code = trimSharedIndent(code);

      const language = guessLanguageByExt(meta.filePath);
      const normalizedLanguage =
        typeof language === 'string'
          ? language.toLowerCase().replace(/[^a-z0-9-]+/g, '')
          : '';
      let highlighted;
      try {
        highlighted = hljs.highlight(code, { language }).value;
      } catch {
        highlighted = escapeHtml(code);
      }

      const numbered = highlighted
        .split('\n')
        .map((line, index) => {
          const content = line.trim().length ? line : ' ';
          const lineNumber = (meta.start || 1) + index;
          const languageAttr = normalizedLanguage
            ? ` class="language-${normalizedLanguage}"`
            : '';
          return `<li value="${lineNumber}"><code${languageAttr}>${content}</code></li>`;
        })
        .join('\n');

      const theme = style || 'light';
      const languageClass = normalizedLanguage
        ? ` language-${normalizedLanguage}`
        : '';

      return `
<div class="gh-embed gh-embed--${theme}">
	<div class="gh-embed__meta">
		<a class="gh-embed__file" href="${meta.web}" target="_blank" rel="noopener noreferrer">
			${meta.filePath}
		</a>
		<div class="gh-embed__actions">
			<a class="gh-embed__raw" href="${meta.raw}" target="_blank" rel="noopener noreferrer">view raw</a>
			<button class="gh-embed__copy" data-clipboard>Copy</button>
		</div>
	</div>
	<pre class="gh-embed__pre hljs${languageClass}">
		<ol class="gh-embed__ol">${numbered}</ol>
	</pre>
</div>`;
    },
  );

  eleventyConfig.addFilter('readableDate', (dateValue, locale = 'en-US') => {
    if (!dateValue) return '';
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
    return formatter.format(date);
  });

  eleventyConfig.addFilter('machineDate', (dateValue) => {
    if (!dateValue) return '';
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  });

  eleventyConfig.addFilter('excerpt', excerpt);

  eleventyConfig.addFilter('absoluteUrl', (path, base = '') => {
    if (!path) return '';
    try {
      const result = new URL(path, base || 'http://localhost');
      return result.toString();
    } catch (error) {
      return path;
    }
  });

  eleventyConfig.on('eleventy.after', ({ results = [] } = {}) => {
    if (!Array.isArray(results) || results.length === 0) {
      return;
    }

    const knownPaths = new Set();
    for (const entry of results) {
      const url = entry?.url;
      if (!url || typeof url !== 'string') continue;
      const normalized = normalizePath(url);
      knownPaths.add(normalized);
      if (normalized !== '/') {
        knownPaths.add(`${normalized}/`);
      }
    }

    const brokenLinks = [];
    for (const entry of results) {
      const { outputPath, content, url: pageUrl } = entry || {};
      if (!outputPath || !content) continue;
      if (!outputPath.endsWith('.html')) continue;

      const baseUrl = new URL(pageUrl || '/', 'http://localhost');
      const linkPattern = /href=(?:"([^"]+)"|'([^']+)')/gi;
      let match;
      while ((match = linkPattern.exec(content)) !== null) {
        const href = match[1] ?? match[2];
        if (shouldSkipHref(href)) continue;
        if (
          !(
            href.startsWith('/') ||
            href.startsWith('./') ||
            href.startsWith('../')
          )
        )
          continue;

        const [hrefWithoutHash] = href.split('#');
        const [hrefWithoutQuery] = hrefWithoutHash.split('?');
        if (hasFileExtension(hrefWithoutQuery)) continue;

        let resolvedPath;
        try {
          const resolved = new URL(href, baseUrl);
          resolvedPath = normalizePath(resolved.pathname);
        } catch (error) {
          brokenLinks.push({
            source: pageUrl || outputPath,
            href,
            error: error.message,
          });
          continue;
        }

        if (!knownPaths.has(resolvedPath)) {
          brokenLinks.push({
            source: pageUrl || outputPath,
            href,
            resolvedPath,
          });
        }
      }
    }

    if (brokenLinks.length > 0) {
      const details = brokenLinks
        .map((link) => {
          const parts = [`source: ${link.source}`, `href: ${link.href}`];
          if (link.resolvedPath) {
            parts.push(`resolved: ${link.resolvedPath}`);
          }
          if (link.error) {
            parts.push(`error: ${link.error}`);
          }
          return `  • ${parts.join(', ')}`;
        })
        .join('\n');
      throw new Error(`Broken internal links detected:\n${details}`);
    }
  });

  eleventyConfig.on('eleventy.before', async () => {
    const { generateOgImages } = await import(
      './scripts/generate-og-images.js'
    );
    await generateOgImages({ force: OG_FORCE_ENV });
  });
}
