# Maintenance Tracker

Track recurring home and car maintenance tasks.

## Features

- Add maintenance tasks with custom intervals (days, weeks, months)
- Set initial "last done" date for existing tasks
- Mark tasks as done (resets the timer)
- View completion history
- Visual status indicators (overdue, due today, upcoming)
- Syncs across devices via Supabase
- PWA support for mobile

## Setup

1. Copy `.env.example` to `.env` and add your Supabase credentials (same as health-tracker)
2. Run the SQL schema in your Supabase project (see `sql/schema.sql`)
3. Install dependencies: `pnpm install`
4. Start dev server: `pnpm dev`

## Example Tasks

- Change furnace filter (every 1 month)
- Car oil change (every 4 months)
- Charge jump starter (every 2 months)
- Clean dishwasher (every 1 month)
- Clean washing machine (every 1 month)
- Clean garbage disposal (every 2 weeks)
