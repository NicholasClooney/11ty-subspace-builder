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

The app currently loads blog posts and prints a basic table of their social sharing status. Future updates will allow editing the metadata directly from the TUI.

## Configuration

Social channels and status states are defined in `tools/post-share-tracker/config.yaml`. Edit that file to add or remove channels without touching the TypeScript source.
