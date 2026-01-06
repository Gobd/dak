# Health Tracker

Track shots and medicine for the family.

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to SQL Editor and run the contents of `sql/schema.sql`
3. Go to Settings > API and copy your Project URL and anon key

### 2. Create User Account

1. In Supabase, go to Authentication > Users
2. Click "Add User" and enter email/password
3. (Optional) Go to Authentication > Settings and disable "Enable email signup" to prevent new signups

### 3. Configure Environment

Create `.env` file:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Run Locally

```bash
pnpm install
pnpm dev
```

### 5. Deploy to Cloudflare

```bash
pnpm build
pnpm deploy
```

## Features

- **Shot Tracking**: Track recurring injections with adjustable cycles and doses
- **Medicine Tracking**: Track antibiotics/medicines with daily dose checkboxes
- **Multi-person**: Track for multiple family members
