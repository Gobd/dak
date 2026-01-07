# Delete Confirmation Modal Implementation Plan

## Problem
When deleting a note, it immediately moves to the next note with no feedback, leaving users confused about what happened.

## Solution
Add a confirmation dialog when trashing notes with an option to skip confirmation for bulk operations.

## Design

### Confirmation Dialog Behavior
When user clicks delete/trash on a note:
1. Show modal: "Delete this note?"
2. Two buttons:
   - **Cancel** - dismiss, no action
   - **Delete** - trash note
3. Checkbox: **"Don't ask again"**
   - When checked, subsequent deletes skip the modal for 30 seconds
   - Timer resets with each delete
   - After 30 seconds of inactivity, confirmation re-enables

### Navigation After Delete
- **Regular delete (with confirmation shown)**: Return to list view after delete
- **Bulk delete mode (confirmation skipped)**: Move to next note, stay in editor view
- **If no next note exists**: Always return to list view

### UI Mockup
```
┌─────────────────────────────────────┐
│          Delete this note?          │
│                                     │
│  "Note title preview here..."       │
│                                     │
│  ☐ Don't ask again                  │
│                                     │
│     [Cancel]         [Delete]       │
└─────────────────────────────────────┘
```

## Implementation Steps

### 1. Extend `ConfirmDialog` component
- Add optional `children?: React.ReactNode` prop
- Render children between message and buttons
- No changes to existing usage in trash.tsx (children is optional)

### 2. Add state to `notes-store.ts`
- Add `skipDeleteConfirmation: boolean` to store state
- Add `skipDeleteConfirmationTimeout: NodeJS.Timeout | null` for the timer
- Add `setSkipDeleteConfirmation(skip: boolean)` action that:
  - Sets the flag
  - Clears any existing timeout
  - If enabling, starts a 30-second timeout to auto-disable
- Add `resetSkipDeleteConfirmationTimer()` to reset the 30s timer on each delete

### 3. Update `app/(main)/index.tsx`
- Add state for delete confirmation dialog visibility
- Add state for note pending deletion
- Add local state for checkbox in dialog
- Modify `handleTrashNote` to check `skipDeleteConfirmation`:
  - If true (bulk mode): proceed directly, reset the 30s timer, move to next note
  - If false: show confirmation dialog, set pending note
- Add `handleConfirmTrash()` that:
  - Checks checkbox state, calls `setSkipDeleteConfirmation` if checked
  - Performs the trash operation
  - Navigates based on mode:
    - Regular delete (confirmation shown): go back to list view
    - Bulk mode (confirmation skipped): move to next note
    - No next note: always go back to list view
  - Clears dialog state

### 4. Add ConfirmDialog to index.tsx
- Reuse existing `ConfirmDialog` component from `/components/ui/confirm-dialog.tsx`
- Add checkbox for "don't ask again" option
- Wire up confirm/cancel handlers

## Files to Modify
- `/components/ui/confirm-dialog.tsx` - add optional `children` prop for custom content (checkbox)
- `/stores/notes-store.ts` - add skip confirmation state with timeout logic
- `/app/(main)/index.tsx` - add dialog and modified trash flow

## Notes
- Reuses existing `ConfirmDialog` component (already used in trash.tsx)
- 30-second timeout prevents accidental deletes if you forget bulk mode is on
- Timer resets with each delete, so rapid bulk deletes work smoothly
