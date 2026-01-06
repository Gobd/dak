/* eslint-disable @typescript-eslint/no-explicit-any, no-undef */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';

// Constants
const DEBOUNCE_MS = 300;

let editor: Editor | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Send message to React Native (native) or parent window (web iframe)
function sendMessage(data: object): void {
  const message = JSON.stringify(data);
  if ((window as any).ReactNativeWebView) {
    // React Native WebView
    (window as any).ReactNativeWebView.postMessage(message);
  } else if (window.parent !== window) {
    // Web iframe - post to parent
    window.parent.postMessage(message, '*');
  }
  // Standalone mode: messages are silently ignored
}

// Initialize editor
function initEditor(initialContent = '', placeholder = 'Start writing...'): void {
  if (editor) {
    editor.destroy();
  }

  try {
    editor = new Editor({
      element: document.getElementById('editor')!,
      extensions: [
        StarterKit,
        TaskList,
        TaskItem.configure({
          nested: true,
          onReadOnlyChecked: () => true,
        }),
        Placeholder.configure({
          placeholder,
        }),
        Markdown.configure({
          markedOptions: {
            gfm: true, // GitHub Flavored Markdown (task lists, tables, etc.)
          },
        }),
      ],
      content: initialContent,
      contentType: 'markdown',
      autofocus: 'end', // Place cursor at end, not select all
      editorProps: {
        attributes: {
          // ID for virtual keyboard extensions and accessibility
          id: 'vk-input',
          // Help mobile keyboards understand this is a text input
          inputmode: 'text',
          // Accessibility
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Note content',
        },
      },
      onUpdate: ({ editor }) => {
        // Debounce content changes
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          const markdown = (editor as any).getMarkdown();
          sendMessage({
            type: 'contentChange',
            markdown,
          });
        }, DEBOUNCE_MS);
      },
    });
  } catch (err) {
    console.error('[TipTap] Failed to create editor:', err);
  }

  // Notify parent that editor is ready
  sendMessage({ type: 'ready' });
}

// Set content helper - handles empty note initialization
function setContentWithFocus(markdown: string): void {
  if (!editor) return;

  if (markdown) {
    editor.commands.setContent(markdown, { contentType: 'markdown' });
    editor.commands.focus('start');
  } else {
    // Empty note: initialize with an empty H1 and focus inside it
    editor.commands.setContent('# ', { contentType: 'markdown' });
    editor.commands.setTextSelection(1);
  }
}

// Handle messages from React Native / parent window
function handleMessage(event: MessageEvent): void {
  let data;
  try {
    data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch {
    // Ignore non-JSON messages
    return;
  }

  switch (data.type) {
    case 'init':
      // If editor already exists, just set content - don't recreate
      if (editor) {
        setContentWithFocus(data.markdown || '');
      } else {
        initEditor(data.markdown || '', data.placeholder || 'Start writing...');
      }
      // Reveal editor now that content is loaded
      document.body.classList.add('ready');
      break;

    case 'setContent':
      setContentWithFocus(data.markdown || '');
      break;

    case 'setTheme':
      if (data.colors) {
        const root = document.documentElement;
        if (data.colors.text) root.style.setProperty('--text-color', data.colors.text);
        if (data.colors.bg) root.style.setProperty('--bg-color', data.colors.bg);
        if (data.colors.placeholder)
          root.style.setProperty('--placeholder-color', data.colors.placeholder);
        if (data.colors.primary) root.style.setProperty('--primary-color', data.colors.primary);
        if (data.colors.muted) root.style.setProperty('--muted-color', data.colors.muted);
        document.body.style.backgroundColor = data.colors.bg;
        document.body.style.color = data.colors.text;
      }
      // Toggle dark mode class for scrollbar styling
      document.body.classList.toggle('dark-mode', !!data.isDark);
      break;

    case 'command':
      if (editor) {
        switch (data.command) {
          case 'toggleTaskList':
            editor.chain().focus().toggleTaskList().run();
            break;
          case 'toggleBulletList':
            editor.chain().focus().toggleBulletList().run();
            break;
          case 'toggleHeading': {
            const level = data.args?.level || 1;
            editor.chain().focus().toggleHeading({ level }).run();
            break;
          }
          case 'focus':
            editor.commands.focus();
            break;
          case 'blur':
            editor.commands.blur();
            break;
          case 'setEditable': {
            const editable = data.args?.editable ?? true;
            editor.setEditable(editable);
            if (!editable) {
              editor.commands.blur();
              document.body.classList.add('read-only-mode');
            } else {
              document.body.classList.remove('read-only-mode');
            }
            document.getElementById('editor')!.style.opacity = editable ? '1' : '0.85';
            break;
          }
        }
      }
      break;

    case 'getContent':
      if (editor) {
        sendMessage({
          type: 'content',
          markdown: (editor as any).getMarkdown(),
        });
      }
      break;
  }
}

// Listen for messages
window.addEventListener('message', handleMessage);
document.addEventListener('message', handleMessage as any); // For Android WebView

// Ensure keyboard pops up on tap (especially for iOS/Android WebView)
document.addEventListener('click', (e) => {
  if (editor && (e.target as Element).closest('.tiptap, #vk-input, [contenteditable]')) {
    editor.commands.focus();
  }
});

// Also handle touch events for mobile
document.addEventListener('touchend', (e) => {
  if (editor && (e.target as Element).closest('.tiptap, #vk-input, [contenteditable]')) {
    // Small delay to let touch event complete
    setTimeout(() => editor?.commands.focus(), 50);
  }
});

// Initialize with empty content on load (will be overwritten by init message)
initEditor();
