# notes-app: Expo → Vite Migration Plan

## Goal

Migrate notes-app from Expo (React Native) to Vite (React web-only), aligning with monorepo patterns and maximizing shared code.

## What Changes

| Before (Expo)            | After (Vite)                       |
| ------------------------ | ---------------------------------- |
| Expo + Metro bundler     | Vite 7.3                           |
| Expo Router (file-based) | React Router DOM 7.12              |
| NativeWind               | Tailwind CSS 4 (@tailwindcss/vite) |
| Custom auth components   | @dak/ui auth (Login, SignUp, etc.) |
| Custom Button/Modal      | @dak/ui components                 |
| Custom theme-store       | @dak/ui createThemeStore           |
| Custom realtime sync     | @dak/ui RealtimeSync class         |
| Tiptap in WebView/iframe | Tiptap native React                |
| expo-\* packages         | Standard web APIs                  |
| iOS/Android support      | Web + PWA only                     |

## What Stays the Same

- Zustand stores (notes-store, tags-store, shares-store, user-store, view-store, toast-store)
- Supabase client + API layer (`lib/api/*`)
- Tiptap editor config (just remove WebView wrapper)
- Core business logic
- Playwright e2e tests

---

## Migration Steps

### Phase 1: Project Setup

1. **Create new Vite structure** alongside existing (or in new branch)

   ```
   notes-app/
   ├── src/
   │   ├── main.tsx
   │   ├── App.tsx
   │   ├── index.css
   │   ├── components/
   │   ├── pages/
   │   ├── stores/
   │   ├── hooks/
   │   ├── lib/
   │   └── types/
   ├── public/
   ├── index.html
   ├── vite.config.ts
   ├── tailwind.config.ts (if needed)
   ├── tsconfig.json
   ├── eslint.config.js
   └── package.json
   ```

2. **Update package.json** - align with monorepo catalog

   ```json
   {
     "name": "notes-app",
     "scripts": {
       "dev": "vite",
       "build": "tsc -b && vite build",
       "preview": "vite preview",
       "lint": "eslint .",
       "typecheck": "tsc --noEmit",
       "format": "prettier --write .",
       "format:check": "prettier --check .",
       "check": "pnpm lint && pnpm format:check && pnpm typecheck && pnpm build",
       "test": "vitest",
       "test:e2e": "playwright test"
     },
     "dependencies": {
       "@dak/ui": "workspace:*",
       "@dak/vite-shared-react": "workspace:*",
       "@supabase/supabase-js": "catalog:vite",
       "@tiptap/react": "^2.x",
       "@tiptap/starter-kit": "^2.x",
       "@tiptap/extension-*": "^2.x",
       "date-fns": "catalog:vite",
       "lucide-react": "catalog:vite",
       "react": "catalog:vite",
       "react-dom": "catalog:vite",
       "react-router-dom": "catalog:vite",
       "zustand": "catalog:vite"
     },
     "devDependencies": {
       "@vitejs/plugin-react": "catalog:vite",
       "@tailwindcss/vite": "catalog:vite",
       "tailwindcss": "catalog:vite",
       "typescript": "catalog:default",
       "vite": "catalog:vite",
       "vite-plugin-pwa": "catalog:vite",
       "eslint": "catalog:default",
       "prettier": "catalog:default",
       "vitest": "^x.x",
       "@playwright/test": "^x.x"
     }
   }
   ```

3. **Create vite.config.ts** - match other apps pattern

   ```typescript
   import react from '@vitejs/plugin-react';
   import tailwindcss from '@tailwindcss/vite';
   import { sharedReact } from '@dak/vite-shared-react';
   import { VitePWA } from 'vite-plugin-pwa';
   import { visualizer } from 'rollup-plugin-visualizer';
   import { defineConfig } from 'vite';

   export default defineConfig({
     base: '/notes-app/',
     plugins: [
       react(),
       tailwindcss(),
       sharedReact(),
       VitePWA({
         registerType: 'autoUpdate',
         manifest: {
           name: 'Notes',
           short_name: 'Notes',
           theme_color: '#000000',
           icons: [
             /* ... */
           ],
         },
       }),
       process.env.ANALYZE && visualizer({ filename: 'stats.html' }),
     ],
     server: { port: 5179 },
   });
   ```

---

### Phase 2: Migrate to @dak/ui

4. **Replace auth components** with @dak/ui
   - Delete: `app/(auth)/login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `set-password.tsx`
   - Use: `@dak/ui` Login, SignUp, ForgotPassword, ResetPassword components
   - Wire up with `createAuthStore({ supabase })`

5. **Replace theme-store** with @dak/ui
   - Delete: `stores/theme-store.ts`
   - Use: `createThemeStore({ storageKey: 'notes-theme' })`

6. **Replace realtime sync** with @dak/ui RealtimeSync
   - Delete: `lib/realtime.ts`
   - Use: `new RealtimeSync({ supabase, channelPrefix: 'notes', onEvent })`
   - Update `useRealtimeSync.ts` hook to use the class

7. **Replace UI components** with @dak/ui
   - Button → `@dak/ui` Button
   - Modal dialogs → `@dak/ui` Modal, ConfirmModal, AlertModal
   - Keep notes-specific components (NotesList, NoteEditor, TagChips, etc.)

---

### Phase 3: Migrate Routing

8. **Convert Expo Router → React Router**

   Create `src/App.tsx`:

   ```tsx
   import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
   import { useAuthStore } from './stores/auth-store';

   // Pages
   import { Login, SignUp, ForgotPassword, ResetPassword } from '@dak/ui';
   import Dashboard from './pages/Dashboard';
   import Settings from './pages/Settings';
   import Trash from './pages/Trash';
   import About from './pages/About';

   function App() {
     const { session, loading } = useAuthStore();

     if (loading) return <LoadingScreen />;

     return (
       <BrowserRouter basename="/notes-app">
         <Routes>
           {!session ? (
             <>
               <Route path="/login" element={<Login {...} />} />
               <Route path="/signup" element={<SignUp {...} />} />
               <Route path="/forgot-password" element={<ForgotPassword {...} />} />
               <Route path="/reset-password" element={<ResetPassword {...} />} />
               <Route path="*" element={<Navigate to="/login" />} />
             </>
           ) : (
             <>
               <Route path="/" element={<Dashboard />} />
               <Route path="/settings" element={<Settings />} />
               <Route path="/trash" element={<Trash />} />
               <Route path="/about" element={<About />} />
               <Route path="*" element={<Navigate to="/" />} />
             </>
           )}
         </Routes>
       </BrowserRouter>
     );
   }
   ```

9. **Migrate page components**
   - `app/(main)/index.tsx` → `src/pages/Dashboard.tsx`
   - `app/(main)/settings.tsx` → `src/pages/Settings.tsx`
   - `app/(main)/trash.tsx` → `src/pages/Trash.tsx`
   - `app/(main)/about.tsx` → `src/pages/About.tsx`
   - Remove Expo Router specific imports (`useRouter`, `useSegments`, etc.)
   - Replace with React Router (`useNavigate`, `useLocation`)

---

### Phase 4: Migrate Components

10. **Convert React Native → React DOM**

    | React Native       | React DOM                 |
    | ------------------ | ------------------------- |
    | `View`             | `div`                     |
    | `Text`             | `span` / `p`              |
    | `TouchableOpacity` | `button`                  |
    | `ScrollView`       | `div` with overflow       |
    | `TextInput`        | `input` / `textarea`      |
    | `FlatList`         | map() or virtualized list |
    | `Pressable`        | `button`                  |
    | `Platform.OS`      | Remove (web only)         |

11. **Convert NativeWind → Tailwind**
    - Mostly the same class names
    - Remove `className` from Text (use on parent or span)
    - Remove any RN-specific classes

12. **Migrate Tiptap to native React**
    - Delete: `RichNoteEditor.tsx` (WebView wrapper)
    - Delete: `public/tiptap-editor.html`
    - Update `NoteEditor.tsx` to use Tiptap directly:

    ```tsx
    import { useEditor, EditorContent } from '@tiptap/react';
    import StarterKit from '@tiptap/starter-kit';
    import TaskList from '@tiptap/extension-task-list';
    import TaskItem from '@tiptap/extension-task-item';

    function NoteEditor({ content, onChange }) {
      const editor = useEditor({
        extensions: [StarterKit, TaskList, TaskItem],
        content,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
      });

      return <EditorContent editor={editor} className="..." />;
    }
    ```

---

### Phase 5: Migrate Platform-Specific Code

13. **Replace expo-\* packages with web APIs**

    | Expo Package           | Web Replacement                    |
    | ---------------------- | ---------------------------------- |
    | `expo-clipboard`       | `navigator.clipboard`              |
    | `expo-file-system`     | File API / Blob                    |
    | `expo-document-picker` | `<input type="file">`              |
    | `expo-sharing`         | Web Share API / download           |
    | `expo-secure-store`    | localStorage (or keep in Supabase) |
    | `AsyncStorage`         | localStorage                       |

14. **Update import/export functionality**
    - `lib/export-notes.ts` → Use Blob + download link
    - `lib/import-notes.ts` → Use File input + FileReader

---

### Phase 6: Cleanup & Polish

15. **Remove all Expo/RN files**
    - Delete: `app.json`, `metro.config.js`, `babel.config.js`
    - Delete: `app/` directory (Expo Router)
    - Delete: `android/`, `ios/` directories
    - Delete: `eas.json`
    - Delete: All `expo-*` and `react-native-*` deps

16. **Update monorepo integration**
    - Ensure `pnpm-workspace.yaml` includes notes-app
    - Verify catalog dependencies resolve correctly
    - Add to root `pnpm dev` script

17. **Update Cloudflare Pages config**
    - Build command: `pnpm build`
    - Output directory: `dist`
    - Base path: `/notes-app/`

---

### Phase 7: Testing & Verification

18. **Manual testing checklist**
    - [ ] Login/logout flow
    - [ ] Create/edit/delete notes
    - [ ] Rich text editing (bold, lists, tasks)
    - [ ] Tags CRUD
    - [ ] Note sharing
    - [ ] Search functionality
    - [ ] Trash/restore
    - [ ] Import/export
    - [ ] Dark/light theme
    - [ ] PWA install
    - [ ] Offline capability

19. **Update/run e2e tests**
    - Update Playwright config for new URLs
    - Run existing auth tests
    - Add any missing coverage

---

## Files to Modify/Create

### New Files

- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`
- `src/pages/*.tsx` (4 pages)
- `vite.config.ts`
- `tsconfig.json`
- `eslint.config.js`
- `index.html`

### Migrate (RN → Web)

- `components/*.tsx` (remove RN primitives)
- `stores/*.ts` (minimal changes, replace auth/theme with @dak/ui)
- `hooks/*.ts` (remove RN-specific hooks)
- `lib/*.ts` (replace expo-\* with web APIs)

### Delete

- `app/` (entire Expo Router directory)
- `app.json`, `metro.config.js`, `babel.config.js`
- `android/`, `ios/` directories
- `eas.json`
- `public/tiptap-editor.html`
- `lib/realtime.ts` (use @dak/ui)
- `stores/theme-store.ts` (use @dak/ui)

---

## Complexity Assessment

**Moderate effort** - Not insane, but not trivial either.

**Easier parts:**

- Stores mostly stay the same
- Supabase integration unchanged
- Tiptap just needs wrapper removed
- @dak/ui provides many components
- Tailwind classes mostly identical to NativeWind

**Harder parts:**

- Converting all RN primitives (View/Text/etc.) to HTML
- Migrating file import/export to web APIs
- Testing everything works correctly
- Ensuring PWA works as well as before

**Estimate:** ~20-30 component files to touch, but most changes are mechanical (View→div, Text→span).

---

## Future: Design System & Maximum Consistency

**Goal:** Every app should look and feel identical. One design language, one component library, one source of truth.

### Priority 1: Unified Design Tokens

Create `packages/ui/src/tokens.css`:

```css
:root {
  /* Colors */
  --color-bg: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-primary: #3b82f6;
  --color-danger: #ef4444;
  --color-success: #22c55e;
  --color-border: #e5e7eb;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

.dark {
  --color-bg: #111827;
  --color-bg-secondary: #1f2937;
  --color-text: #f9fafb;
  --color-text-muted: #9ca3af;
  --color-border: #374151;
}
```

All apps import this. All components use these variables.

### Priority 2: Expand @dak/ui Component Library

**Core components every app needs:**

- Button (exists)
- Modal, ConfirmModal, AlertModal (exist)
- Input, Textarea, Select
- Card, CardHeader, CardBody
- Toast/Notification
- LoadingSpinner, Skeleton
- EmptyState
- Badge/Tag
- Avatar
- Dropdown/Menu
- Tooltip
- Tabs
- Sidebar, NavItem
- PageHeader, PageContainer

**Form components:**

- FormField (label + input + error)
- Checkbox, Radio, Switch
- DatePicker, TimePicker (exist)

**Data components:**

- Table, TableRow, TableCell
- List, ListItem
- Pagination

### Priority 3: Add Storybook

1. **Setup Storybook 8** in `packages/ui/`

   ```bash
   pnpm dlx storybook@latest init
   ```

2. **Configure for Vite + Tailwind**
   - `.storybook/main.ts` - Vite builder
   - `.storybook/preview.ts` - Import global CSS, dark mode decorator

3. **Add stories for existing components**

   ```
   packages/ui/src/
   ├── components/
   │   ├── Button.tsx
   │   ├── Button.stories.tsx    # NEW
   │   ├── Modal.tsx
   │   ├── Modal.stories.tsx     # NEW
   │   └── ...
   ```

4. **Add npm script**

   ```json
   "storybook": "storybook dev -p 6006",
   "build-storybook": "storybook build"
   ```

5. **Optional: Deploy to Cloudflare Pages**
   - `/storybook/` route for component docs

### Candidates to Extract to @dak/ui

From notes-app (after migration):

- **Toast/notification system** - toast-store pattern
- **SearchBar** - reusable search input with icon
- **TagChips** - colored tag pills (generic enough)
- **EmptyState** - placeholder for empty lists
- **LoadingSpinner** - consistent loading indicator

From other apps (audit needed):

- **Card** - consistent card container
- **Input/Textarea** - styled form inputs
- **Select/Dropdown** - styled select
- **Sidebar/Navigation** - common nav patterns
- **PageHeader** - consistent page headers
- **Table** - data table component

### Shared Styles Strategy

1. **Move common Tailwind config to packages/ui**
   - Shared color palette
   - Common spacing/sizing
   - Typography presets
   - Dark mode colors

2. **Create CSS variables in @dak/ui**

   ```css
   :root {
     --color-primary: ...;
     --color-danger: ...;
     --radius-default: ...;
   }
   ```

3. **Export Tailwind preset from @dak/ui**

   ```typescript
   // packages/ui/tailwind.preset.ts
   export default {
     theme: {
       extend: {
         colors: {
           /* shared */
         },
         // ...
       },
     },
   };
   ```

   Apps use:

   ```typescript
   // vite.config.ts or tailwind.config.ts
   import uiPreset from '@dak/ui/tailwind.preset';
   ```

### Benefits

- Single source of truth for design tokens
- Storybook as living documentation
- Easier onboarding / visual testing
- Consistent look across all apps
- Smaller individual app bundles (shared code)
