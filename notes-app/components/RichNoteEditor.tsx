import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import { Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, useThemeColors } from '@/hooks/useThemeColors';

// Conditionally import WebView and Asset only for native platforms
const WebView = Platform.OS !== 'web' ? require('react-native-webview').WebView : null;
const Asset = Platform.OS !== 'web' ? require('expo-asset').Asset : null;

// Load HTML asset for native - returns asset module
const editorHtmlModule = Platform.OS !== 'web' ? require('../assets/tiptap-editor.html') : null;

export interface RichNoteEditorRef {
  toggleTaskList: () => void;
  toggleBulletList: () => void;
  toggleHeading: (level: 1 | 2 | 3) => void;
  setEditable: (editable: boolean) => void;
  blur: () => void;
}

interface RichNoteEditorProps {
  content: string; // markdown content
  onUpdate: (content: string) => void; // returns markdown
  maxLength?: number;
  placeholder?: string;
}

interface ThemeColors {
  text: string;
  bg: string;
  placeholder: string;
  primary: string;
  muted: string;
}

// =============================================================================
// SHARED HOOK - Common editor bridge logic for both platforms
// =============================================================================

function useEditorBridge(
  postMessage: (message: object) => void,
  content: string,
  onUpdate: (content: string) => void,
  maxLength: number,
  placeholder: string,
  themeColors: ThemeColors,
  isDark: boolean
) {
  const lastContentRef = useRef(content);
  const isReadyRef = useRef(false);
  const pendingInitRef = useRef<string | null>(null);
  const isInInitPhaseRef = useRef(false);

  const sendTheme = useCallback(() => {
    postMessage({
      type: 'setTheme',
      isDark,
      colors: themeColors,
    });
  }, [postMessage, themeColors, isDark]);

  const initEditor = useCallback(
    (markdown: string) => {
      postMessage({ type: 'init', markdown, placeholder });
      sendTheme();
    },
    [postMessage, placeholder, sendTheme]
  );

  const handleEditorMessage = useCallback(
    (data: { type: string; markdown?: string }) => {
      switch (data.type) {
        case 'ready':
          isReadyRef.current = true;
          // Init phase to absorb TipTap's markdown normalization
          // Must exceed TipTap's 300ms debounce (see entry.ts DEBOUNCE_MS)
          isInInitPhaseRef.current = true;
          setTimeout(() => {
            isInInitPhaseRef.current = false;
          }, 400);
          if (pendingInitRef.current !== null) {
            initEditor(pendingInitRef.current);
            pendingInitRef.current = null;
          } else {
            initEditor(content);
          }
          break;

        case 'contentChange':
          if (
            data.markdown !== undefined &&
            data.markdown !== lastContentRef.current &&
            data.markdown.length <= maxLength
          ) {
            lastContentRef.current = data.markdown;
            // Skip saves during init phase (TipTap normalizing markdown)
            if (isInInitPhaseRef.current) {
              break;
            }
            onUpdate(data.markdown);
          }
          break;
      }
    },
    [content, initEditor, maxLength, onUpdate]
  );

  // Update content when it changes externally
  useEffect(() => {
    if (content !== lastContentRef.current) {
      lastContentRef.current = content;
      if (isReadyRef.current) {
        postMessage({ type: 'setContent', markdown: content });
      } else {
        pendingInitRef.current = content;
      }
    }
  }, [content, postMessage]);

  // Update theme when colors change
  useEffect(() => {
    if (isReadyRef.current) {
      sendTheme();
    }
  }, [sendTheme]);

  const editorMethods: RichNoteEditorRef = {
    toggleTaskList: () => postMessage({ type: 'command', command: 'toggleTaskList' }),
    toggleBulletList: () => postMessage({ type: 'command', command: 'toggleBulletList' }),
    toggleHeading: (level: 1 | 2 | 3) =>
      postMessage({ type: 'command', command: 'toggleHeading', args: { level } }),
    setEditable: (editable: boolean) =>
      postMessage({ type: 'command', command: 'setEditable', args: { editable } }),
    blur: () => postMessage({ type: 'command', command: 'blur' }),
  };

  return { handleEditorMessage, editorMethods };
}

// =============================================================================
// WEB EDITOR - Uses iframe loading the same HTML as native
// =============================================================================

const WebRichNoteEditor = forwardRef<RichNoteEditorRef, RichNoteEditorProps>(
  function WebRichNoteEditor(
    { content, onUpdate, maxLength = 50000, placeholder = 'Start writing...' },
    ref
  ) {
    const colors = useThemeColors();
    const { isDark } = useTheme();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const postMessage = useCallback((message: object) => {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(message), '*');
    }, []);

    const themeColors: ThemeColors = {
      text: colors.text,
      bg: colors.bg,
      placeholder: colors.inputPlaceholder,
      primary: colors.primary,
      muted: colors.textMuted,
    };

    const { handleEditorMessage, editorMethods } = useEditorBridge(
      postMessage,
      content,
      onUpdate,
      maxLength,
      placeholder,
      themeColors,
      isDark
    );

    // Handle messages from iframe
    useEffect(() => {
      // eslint-disable-next-line no-undef
      const handleMessage = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          handleEditorMessage(data);
        } catch {
          // Ignore non-JSON messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [handleEditorMessage]);

    // Blur editor on unmount to dismiss virtual keyboard
    useEffect(() => {
      const iframe = iframeRef.current;
      return () => {
        iframe?.contentWindow?.postMessage(
          JSON.stringify({ type: 'command', command: 'blur' }),
          '*'
        );
      };
    }, []);

    useImperativeHandle(ref, () => editorMethods);

    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <iframe
          ref={iframeRef}
          id="tiptap-editor-frame"
          src="/tiptap-editor.html"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: colors.bg,
          }}
          title="Note Editor"
        />
      </View>
    );
  }
);

// =============================================================================
// NATIVE EDITOR - Uses WebView (iOS/Android)
// =============================================================================

const NativeRichNoteEditor = forwardRef<RichNoteEditorRef, RichNoteEditorProps>(
  function NativeRichNoteEditor(
    { content, onUpdate, maxLength = 50000, placeholder = 'Start writing...' },
    ref
  ) {
    const colors = useThemeColors();
    const { isDark } = useTheme();
    const webviewRef = useRef<typeof WebView>(null);
    const [htmlUri, setHtmlUri] = useState<string | null>(null);

    // Load the HTML asset on mount
    useEffect(() => {
      async function loadHtmlAsset() {
        if (editorHtmlModule && Asset) {
          const asset = Asset.fromModule(editorHtmlModule);
          await asset.downloadAsync();
          setHtmlUri(asset.localUri || asset.uri);
        }
      }
      loadHtmlAsset();
    }, []);

    const postMessage = useCallback((message: object) => {
      webviewRef.current?.postMessage(JSON.stringify(message));
    }, []);

    const themeColors: ThemeColors = {
      text: colors.text,
      bg: colors.bg,
      placeholder: colors.inputPlaceholder,
      primary: colors.primary,
      muted: colors.textMuted,
    };

    const { handleEditorMessage, editorMethods } = useEditorBridge(
      postMessage,
      content,
      onUpdate,
      maxLength,
      placeholder,
      themeColors,
      isDark
    );

    const handleMessage = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: any) => {
        try {
          const rawData = event.nativeEvent.data;
          if (typeof rawData !== 'string') return;
          const data = JSON.parse(rawData);
          handleEditorMessage(data);
        } catch {
          // Ignore non-JSON messages
        }
      },
      [handleEditorMessage]
    );

    useImperativeHandle(ref, () => editorMethods);

    if (!htmlUri) {
      return (
        <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="small" color={colors.textMuted} />
        </View>
      );
    }

    return (
      <WebView
        ref={webviewRef}
        source={{ uri: htmlUri }}
        style={{ flex: 1, backgroundColor: colors.bg }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        scrollEnabled={true}
        bounces={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowFileAccess={true}
      />
    );
  }
);

// =============================================================================
// MAIN EXPORT - Routes to Web or Native implementation
// =============================================================================

export const RichNoteEditor = forwardRef<RichNoteEditorRef, RichNoteEditorProps>(
  function RichNoteEditor(props, ref) {
    if (Platform.OS === 'web') {
      return <WebRichNoteEditor {...props} ref={ref} />;
    }
    return <NativeRichNoteEditor {...props} ref={ref} />;
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
