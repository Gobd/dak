# @dak/hooks

Shared React hooks for common patterns across apps.

## Hooks

### useLocalStorage

Persist state to localStorage with automatic JSON serialization.

```tsx
const [value, setValue] = useLocalStorage('key', defaultValue);
```

### useInterval

Run a callback on an interval with automatic cleanup.

```tsx
useInterval(() => fetchData(), 5000);
```

### useMediaQuery

React to CSS media query changes.

```tsx
const isMobile = useMediaQuery('(max-width: 768px)');
```

### useKeyPress

Handle keyboard events declaratively.

```tsx
useKeyPress('Escape', () => closeModal());
```

### useToggle

Boolean state with toggle, on, and off methods.

```tsx
const [isOpen, { toggle, on, off }] = useToggle(false);
```

### useCopyToClipboard

Copy text to clipboard with success/error handling.

```tsx
const { copy, copied } = useCopyToClipboard();
```

### useDarkMode

Detect and manage dark mode state.

```tsx
const { isDark, toggle } = useDarkMode();
```

## Usage

```tsx
import { useLocalStorage, useToggle, useDarkMode } from '@dak/hooks';
```
