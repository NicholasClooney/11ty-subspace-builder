# Post Share Tracker

Ink-based TUI that helps maintain social sharing metadata for the blog posts in this repository.

## Setup

Install dependencies from the repo root:

```sh
npm install
```

## Usage

Run the tracker in development mode:

```sh
npm run --workspace post-share-tracker start
```

The app loads blog posts, prints a channel/status table, and lets you interactively update frontmatter:
- Type to filter the post list; `Backspace` edits, `Esc` clears the filter.
- Use the first prompt to choose a post, then pick a channel and status.
- Press `Esc` to step back (status → channel → post) or change your selection.
- Selecting a new status writes the update to disk (auto-timestamping `shared` statuses) and refreshes the table.

## Configuration

Social channels and status states are defined in `tools/post-share-tracker/config.yaml`. Edit that file to add or remove channels without touching the TypeScript source.

## Programmatic Updates

Use `savePostSocial` (`tools/post-share-tracker/src/savePostSocial.ts`) to write channel status updates back to a post's Markdown frontmatter. The helper validates channel/state names against `config.yaml`, supports dry runs, and can auto-stamp a `lastShared` timestamp when marking a channel as `shared`. The TUI relies on the same helper, so programmatic and interactive updates stay in sync.
