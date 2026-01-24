# Notes App

Rich-text note-taking app with real-time sync, sharing, and organization features.

## Features

- Rich text editing with Tiptap (markdown, task lists, formatting)
- Tag-based organization with colored labels
- Search and sort (alphabetical, recently updated, oldest)
- Note sharing with other users
- Trash bin with restore/permanent delete
- Privacy controls (private/public)
- Pin notes to top
- Real-time sync across devices

## Authentication

Uses Supabase Auth with email/password and OAuth providers. Includes password reset flow.

## Development

```bash
pnpm dev      # Start dev server on port 5179
```

Requires Supabase project with auth and database configured.
