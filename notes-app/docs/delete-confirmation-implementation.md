# Delete & Bulk Delete Implementation Plan

## Problem
When deleting a note, it immediately moves to the next note with no feedback, leaving users confused about what happened.

## Solution
1. Single delete always returns to list view (with confirmation)
2. Add explicit bulk delete UI with checkboxes in both Notes list and Trash list

---

## Part 1: Single Delete Behavior

### Notes View
- Delete note → show confirmation → trash note → return to list view

### Trash View
- Delete note → show confirmation → permanently delete → stay in trash list

Both show confirmation dialog before any delete action.

---

## Part 2: Bulk Delete UI

### Design
Both Notes list and Trash list get:
- "Select" button in header to enter selection mode
- Checkbox on each note row (only visible in selection mode)
- "Select All" checkbox in header (selection mode)
- Action bar with count + delete button (selection mode)
- "✕" cancel button to exit selection mode

### UI Mockup - Normal Mode
```
┌─────────────────────────────────────┐
│ All Notes              [+] [Select] │
├─────────────────────────────────────┤
│ Note title one...                   │
│ Note title two...                   │
│ Note title three...                 │
└─────────────────────────────────────┘
```

### UI Mockup - Selection Mode
```
┌─────────────────────────────────────┐
│ ☐ All    2 selected   [Delete] [✕] │
├─────────────────────────────────────┤
│ ☑ Note title one...                 │
│ ☐ Note title two...                 │
│ ☑ Note title three...               │
└─────────────────────────────────────┘
```

- Tap "Select" → enters selection mode, checkboxes appear
- Tap "✕" or complete bulk action → exits selection mode, checkboxes hide

### Bulk Delete Confirmation - Notes
```
┌─────────────────────────────────────┐
│      Delete 3 notes?                │
│                                     │
│  This will move 3 notes to trash.   │
│                                     │
│     [Cancel]         [Delete]       │
└─────────────────────────────────────┘
```

### Bulk Delete Confirmation - Trash
```
┌─────────────────────────────────────┐
│  Permanently delete 3 notes?        │
│                                     │
│  This action cannot be undone.      │
│                                     │
│     [Cancel]         [Delete]       │
└─────────────────────────────────────┘
```

---

## Implementation Steps

### 1. Update single delete to return to list
- Modify `handleTrashNote` in `app/(main)/index.tsx`:
  - After trash, call `setCurrentNote(null)`
  - On mobile, also `setShowSidebar(true)`
- Same pattern for trash view permanent delete

### 2. Add selection state
- Add to component state (not store - selection is ephemeral):
  - `selectedNoteIds: Set<string>`
  - `isSelectionMode: boolean`
- "Select" button in header toggles `isSelectionMode`
- "✕" button or completing action exits selection mode

### 3. Update NotesList component
- Add `selectionMode` prop (boolean)
- Add `selectedIds` prop (Set<string>)
- Add `onToggleSelect` prop (id: string) => void
- Show checkbox on each row only when `selectionMode` is true

### 4. Update header in selection mode
- Replace normal header with selection header when `isSelectionMode`
- Show: "☐ All" checkbox | "X selected" count | [Delete] button | [✕] cancel
- "☐ All" toggles select all / deselect all

### 5. Add bulk trash action
- `bulkTrashNotes(ids: string[], userId: string)` in notes-store
- Show confirmation with count
- After bulk trash, clear selection, exit selection mode

### 6. Update Trash view
- Same selection mode UI as Notes list
- "Select" button to enter selection mode
- Bulk permanent delete action with confirmation
- "Delete All" button (selects all + confirms permanent delete)

---

## Files to Modify
- `/app/(main)/index.tsx` - single delete returns to list, add selection state, bulk trash
- `/app/trash.tsx` - single delete with confirmation, add selection state, bulk permanent delete
- `/components/NotesList.tsx` - add checkbox selection UI, select all
- `/stores/notes-store.ts` - add `bulkTrashNotes` and `bulkDeletePermanently` actions
- `/components/ui/confirm-dialog.tsx` - no changes needed (already supports dynamic message)

---

## Notes
- Selection state is local (not persisted) - clears on navigation
- Long-press to enter selection mode (mobile), or header toggle (desktop)
- Confirmation always shown for delete operations
