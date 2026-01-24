# @dak/vite-shared-react

Shared Vite configuration, theme system, and vendor bundling for all React apps.

## Vite Config

```ts
import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({ port: 3001 });
```

Includes:

- React plugin with Tailwind CSS
- PWA support
- Bundle analysis (set `ANALYZE=true`)
- Import map injection for shared vendor bundles
- TypeScript sourcemaps

## Theme

Import in your app's `index.css`:

```css
@import '@dak/vite-shared-react/theme.css';
```

Provides semantic color tokens:

| Token                       | Purpose            |
| --------------------------- | ------------------ |
| `bg-surface`                | Default background |
| `bg-surface-raised`         | Cards, modals      |
| `bg-surface-sunken`         | Inset areas        |
| `text-text`                 | Primary text       |
| `text-text-secondary`       | Secondary text     |
| `text-text-muted`           | Disabled/hint text |
| `border-border`             | Borders            |
| `bg-accent`                 | Primary actions    |
| `bg-success/warning/danger` | Status colors      |

Dark mode is handled automatically via the `dark` class on `<html>`.

## Fonts

```css
@import '@dak/vite-shared-react/fonts.css';
```

Preloads shared web fonts.

## Vendor Bundles

Pre-built bundles for React, React-DOM, and Zustand to optimize shared dependencies across apps.
