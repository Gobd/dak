import { useCallback, useEffect, useRef, useState } from 'react';
import { useInterval, useLocalStorage } from '@dak/hooks';
import { Button, Input, Toggle } from '@dak/ui';
import {
  Keyboard,
  Mic,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Square,
  Terminal,
  Volume2,
} from 'lucide-react';
import { api, managerOrigin, type Block, type Message, type Preset, type Session } from './api';
import { useVoice } from './useVoice';
import FolderPicker from './FolderPicker';

const selectClass = 'w-full rounded-lg border border-border bg-surface-sunken p-3 text-text';
const initialSettings = {
  managerUrl: '',
  review: false,
  autoplay: true,
  voiceURI: '',
  connectedBefore: false,
};

export default function App() {
  const [settings, setSettings] = useLocalStorage('rex-voice-settings', initialSettings);
  const [history, setHistory] = useLocalStorage<Message[]>('rex-voice-history', []);
  const [connected, setConnected] = useState(false);
  const [managerEnabled, setManagerEnabled] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [sessionId, setSessionId] = useLocalStorage('rex-voice-session', '');
  const [blockId, setBlockId] = useState('');
  const [mode, setMode] = useLocalStorage<'manager' | 'terminal'>('rex-voice-target', 'terminal');
  const [screen, setScreen] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);
  const [presetId, setPresetId] = useState('');
  const [launchCwd, setLaunchCwd] = useState('');
  const [showFolders, setShowFolders] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');
  const captureBusy = useRef(false);
  const screenRef = useRef<HTMLPreElement>(null);

  const request = useCallback(
    <T,>(route: string, body?: unknown) => api<T>(route, body, settings.managerUrl),
    [settings.managerUrl],
  );

  const refreshSessions = useCallback(async () => {
    const result = await request<{ sessions: Session[] }>('sessions');
    setSessions(result.sessions);
    setSessionId((current) =>
      result.sessions.some((session) => session.session_id === current)
        ? current
        : result.sessions[0]?.session_id || '',
    );
  }, [request]);

  async function connect() {
    if (busyRef.current) return;
    busyRef.current = true;
    attemptedConnection.current = true;
    setBusy(true);
    setError('');
    try {
      managerOrigin(settings.managerUrl);
      const [status, launchers] = await Promise.all([
        request<{ managerEnabled: boolean }>('status'),
        request<{ presets: Preset[] }>('presets'),
      ]);
      await refreshSessions();
      setManagerEnabled(status.managerEnabled);
      setPresets(launchers.presets);
      setPresetId(launchers.presets[0]?.id || '');
      setLaunchCwd(launchers.presets[0]?.cwd || '');
      setConnected(true);
      setSettings((previous) => ({ ...previous, connectedBefore: true }));
      setShowSettings(false);
    } catch (cause) {
      setConnected(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not connect. Check WireGuard and the Mac manager.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const connectRef = useRef(connect);
  connectRef.current = connect;
  const attemptedConnection = useRef(false);
  useEffect(() => {
    if (!attemptedConnection.current && settings.connectedBefore) {
      attemptedConnection.current = true;
      void connectRef.current();
    }
  }, [settings.connectedBefore]);

  useEffect(() => {
    if (!connected || !sessionId) {
      setBlocks([]);
      setBlockId('');
      return;
    }
    let cancelled = false;
    setBlocks([]);
    setBlockId('');
    setScreen('');
    void request<{ blocks: Block[] }>(`blocks?session=${encodeURIComponent(sessionId)}`)
      .then((result) => {
        if (cancelled) return;
        const terminals = result.blocks.filter(
          (block) => block.creator_name === 'com.superlogical.terminal',
        );
        setBlocks(terminals);
        setBlockId(terminals[0]?.block_id || '');
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, sessionId, request]);

  const refreshScreen = useCallback(async () => {
    if (!connected || !sessionId || !blockId || captureBusy.current || document.hidden) return;
    captureBusy.current = true;
    try {
      const result = await request<{ screen: string }>(
        `capture?session=${encodeURIComponent(sessionId)}&block=${encodeURIComponent(blockId)}`,
      );
      setScreen(result.screen);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read the terminal.');
    } finally {
      captureBusy.current = false;
    }
  }, [connected, sessionId, blockId, request]);

  useEffect(() => {
    setScreen('');
    void refreshScreen();
  }, [refreshScreen]);
  useInterval(
    () => {
      void refreshScreen();
    },
    connected && mode === 'terminal' ? 3000 : null,
  );
  useEffect(() => {
    if (screenRef.current) screenRef.current.scrollTop = screenRef.current.scrollHeight;
  }, [screen]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => document.documentElement.classList.toggle('dark', media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  async function sendMessage(message: string) {
    if (!message.trim() || busyRef.current || !connected) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    voice.stopSpeaking();
    try {
      if (mode === 'terminal') {
        await request('send', { session: sessionId, block: blockId, message: message.trim() });
        await refreshScreen();
      } else {
        const response = await request<{ text: string }>('chat', {
          message: message.trim(),
          history: history
            .slice(-10)
            .map((message) => ({ ...message, text: message.text.slice(-4000) })),
          session: sessionId || undefined,
        });
        setHistory((previous) =>
          [
            ...previous,
            { role: 'user', text: message.trim() } as Message,
            { role: 'assistant', text: response.text } as Message,
          ].slice(-30),
        );
        if (settings.autoplay) voice.speak(response.text);
      }
      setDraft('');
      setShowKeyboard(false);
    } catch (cause) {
      setDraft(message);
      setShowKeyboard(true);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Message could not be sent. It has been kept in the keyboard editor.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const voice = useVoice((transcript) => {
    if (settings.review) {
      setDraft(transcript);
      setShowKeyboard(true);
    } else void sendMessage(transcript);
  }, settings.voiceURI);

  async function sendKey(key: string) {
    if (busyRef.current || !blockId) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await request('key', { session: sessionId, block: blockId, key });
      await refreshScreen();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the key.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function launch() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const created = await request<{ session_id: string }>('launch', {
        preset: presetId,
        cwd: launchCwd || undefined,
        label: sessionLabel || undefined,
      });
      await refreshSessions();
      setSessionId(created.session_id);
      setMode('terminal');
      setShowLaunch(false);
      setSessionLabel('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not start the session. Refresh sessions before retrying.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const ready =
    connected && !busy && !showSettings && (mode === 'manager' ? managerEnabled : !!blockId);
  const chosenPreset = presets.find((preset) => preset.id === presetId);

  return (
    <main className="rex-shell mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Rex <span className="text-accent">Voice</span>
          </h1>
          <p className="text-sm text-text-secondary">Your agents, within reach.</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          disabled={busy || voice.listening}
          onClick={() => {
            voice.stopSpeaking();
            setShowSettings(!showSettings);
          }}
        >
          <Settings size={22} />
        </Button>
      </header>

      {showSettings && (
        <section
          className="space-y-5 rounded-xl border border-border bg-surface-raised p-5"
          aria-label="Connection and voice settings"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Mac manager address (default port 5184)
            </span>
            <Input
              type="url"
              placeholder="https://rex.example.com:5184"
              value={settings.managerUrl}
              onChange={(event) => {
                setConnected(false);
                setSettings({ ...settings, managerUrl: event.target.value });
              }}
            />
          </label>
          <p className="text-sm text-text-secondary">
            On this Mac, leave blank for the dev proxy or use http://localhost:5184. For Android
            over WireGuard, use your private HTTPS address.
          </p>
          <div className="flex flex-col gap-4">
            <Toggle
              label="Review before sending"
              checked={settings.review}
              onChange={(review) => setSettings({ ...settings, review })}
            />
            <Toggle
              label="Read manager replies aloud"
              checked={settings.autoplay}
              onChange={(autoplay) => setSettings({ ...settings, autoplay })}
            />
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Reply voice</span>
            <select
              className={selectClass}
              value={settings.voiceURI}
              onChange={(event) => setSettings({ ...settings, voiceURI: event.target.value })}
            >
              <option value="">Android / browser default</option>
              {voice.voices.map((item) => (
                <option key={item.voiceURI} value={item.voiceURI}>
                  {item.name} · {item.lang}
                  {item.localService ? ' · on device' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-text-secondary">
            Chrome may use an online speech service for recognition. Only the final transcript is
            sent to your Mac.
          </p>
          <Button loading={busy} onClick={() => void connect()}>
            {connected ? 'Reconnect' : 'Connect'}
          </Button>
        </section>
      )}

      {connected && !showSettings && (
        <>
          <section className="flex flex-wrap gap-2" aria-label="Conversation target">
            <Button
              variant={mode === 'manager' ? 'primary' : 'secondary'}
              disabled={busy || voice.listening}
              onClick={() => setMode('manager')}
            >
              Manager
            </Button>
            <Button
              variant={mode === 'terminal' ? 'primary' : 'secondary'}
              disabled={busy || voice.listening}
              onClick={() => setMode('terminal')}
            >
              <Terminal size={18} className="mr-2" />
              Agent terminal
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh sessions"
              disabled={busy}
              onClick={() =>
                void refreshSessions().catch((cause: Error) => setError(cause.message))
              }
            >
              <RefreshCw size={19} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Start an agent"
              disabled={!presets.length || busy}
              onClick={() => setShowLaunch(!showLaunch)}
            >
              <Plus size={18} className="mr-2" />
              Start an agent
            </Button>
          </section>
          <label className="block">
            <span className="mb-2 block text-sm text-text-secondary">
              {mode === 'manager' ? 'Session to discuss' : 'Session'}
            </span>
            <select
              className={selectClass}
              value={sessionId}
              disabled={busy || voice.listening}
              onChange={(event) => setSessionId(event.target.value)}
            >
              {mode === 'manager' && <option value="">All sessions</option>}
              {!sessions.length && <option value="">No sessions running</option>}
              {sessions.map((item) => (
                <option key={item.session_id} value={item.session_id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {showLaunch && (
            <section
              className="space-y-3 rounded-xl border border-border bg-surface-raised p-4"
              aria-label="Start an agent"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Launch preset</span>
                <select
                  className={selectClass}
                  value={presetId}
                  onChange={(event) => {
                    setPresetId(event.target.value);
                    setLaunchCwd(
                      presets.find((preset) => preset.id === event.target.value)?.cwd || '',
                    );
                  }}
                >
                  {presets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {chosenPreset && (
                <>
                  <code className="block break-all text-sm text-text-secondary">
                    {chosenPreset.command.join(' ')}
                  </code>
                  <p className="break-all text-xs text-text-muted">{chosenPreset.cwd}</p>
                </>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Working directory</span>
                <div className="flex gap-2">
                  <Input
                    value={launchCwd}
                    onChange={(event) => setLaunchCwd(event.target.value)}
                    placeholder={chosenPreset?.cwd}
                  />
                  <Button variant="secondary" onClick={() => setShowFolders(!showFolders)}>
                    Browse
                  </Button>
                </div>
              </label>
              {showFolders && (
                <FolderPicker
                  request={request}
                  onChoose={(directory) => {
                    setLaunchCwd(directory);
                    setShowFolders(false);
                  }}
                  onClose={() => setShowFolders(false)}
                />
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Session name (optional)</span>
                <Input
                  value={sessionLabel}
                  onChange={(event) => setSessionLabel(event.target.value)}
                  placeholder={presetId}
                />
              </label>
              <Button loading={busy} onClick={() => void launch()}>
                Start session
              </Button>
            </section>
          )}

          {mode === 'terminal' ? (
            <section className="space-y-3">
              <label className="block">
                <span className="mb-2 block text-sm text-text-secondary">Terminal</span>
                <select
                  className={selectClass}
                  value={blockId}
                  disabled={busy || voice.listening}
                  onChange={(event) => setBlockId(event.target.value)}
                >
                  {!blocks.length && <option value="">No terminals available</option>}
                  {blocks.map((item) => (
                    <option key={item.block_id} value={item.block_id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-text-muted">
                Messages are typed into this terminal and submitted with Return. Select a terminal
                running your agent.
              </p>
              <div className="flex flex-wrap gap-2" aria-label="Terminal keys">
                {(
                  [
                    ['up', '↑'],
                    ['down', '↓'],
                    ['enter', 'Enter'],
                    ['escape', 'Esc'],
                    ['tab', 'Tab'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    variant="secondary"
                    size="sm"
                    disabled={busy || voice.listening || !blockId}
                    aria-label={'Press ' + key}
                    onClick={() => void sendKey(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <pre
                ref={screenRef}
                className="max-h-[48dvh] min-h-48 overflow-auto whitespace-pre rounded-xl border border-border bg-surface-sunken p-4 font-mono text-xs leading-relaxed"
                aria-label="Live terminal screen"
              >
                {screen || 'Waiting for terminal output…'}
              </pre>
              <div className="flex justify-between text-xs text-text-muted">
                <span>Current screen · refreshes every 3 seconds</span>
                <button type="button" className="text-accent" onClick={() => void refreshScreen()}>
                  Refresh
                </button>
              </div>
            </section>
          ) : (
            <section className="flex flex-1 flex-col gap-4" aria-label="Manager replies">
              {!managerEnabled && (
                <p className="rounded-xl bg-surface-sunken p-4 text-text-secondary">
                  Manager chat isn’t configured yet. You can use Agent terminal to talk to an
                  existing agent.
                </p>
              )}
              {managerEnabled && !history.length && (
                <p className="py-10 text-center text-text-secondary">
                  Tap the microphone and ask what your agents are doing.
                </p>
              )}
              {history
                .filter((message) => message.role === 'assistant')
                .map((message, index) => (
                  <article
                    key={`${index}-${message.text.slice(0, 32)}`}
                    className="rounded-xl border border-border bg-surface-raised p-4"
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!voice.synthesisSupported || voice.listening}
                      onClick={() => voice.speak(message.text)}
                    >
                      <Volume2 size={16} className="mr-2" />
                      Read aloud
                    </Button>
                  </article>
                ))}
              {!!history.length && (
                <button
                  type="button"
                  className="self-start text-xs text-text-muted"
                  onClick={() => {
                    voice.stopSpeaking();
                    setHistory([]);
                  }}
                >
                  Clear conversation
                </button>
              )}
            </section>
          )}
        </>
      )}

      {(error || voice.error) && (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-danger-light p-3 text-sm text-danger"
        >
          {error || voice.error}
        </p>
      )}
      {connected && !showSettings && (
        <footer className="sticky bottom-0 mt-auto space-y-3 rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-center text-sm text-text-secondary" role="status">
            {busy
              ? 'Working…'
              : voice.listening
                ? 'Listening… tap to finish'
                : settings.review
                  ? 'Speak, review, then send'
                  : 'Speak and send automatically'}
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Type a message"
              disabled={busy || voice.listening}
              onClick={() => setShowKeyboard(!showKeyboard)}
            >
              <Keyboard size={23} />
            </Button>
            <Button
              rounded
              size="lg"
              className="min-h-20 min-w-20"
              disabled={!ready || !voice.recognitionSupported}
              aria-label={voice.listening ? 'Finish speaking' : 'Speak a message'}
              aria-pressed={voice.listening}
              onClick={voice.toggleListening}
            >
              {voice.listening ? <Square size={30} /> : <Mic size={30} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Stop voice playback"
              disabled={!voice.speaking}
              onClick={voice.stopSpeaking}
            >
              <Square size={21} />
            </Button>
          </div>
          {!voice.recognitionSupported && (
            <p className="text-center text-xs text-text-muted">
              Microphone unavailable. Use Chrome over HTTPS, or type a message.
            </p>
          )}
          {showKeyboard && (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(draft);
              }}
            >
              <label className="sr-only" htmlFor="rex-message">
                Message
              </label>
              <textarea
                id="rex-message"
                rows={2}
                maxLength={8000}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface-sunken p-3 text-text"
                value={draft}
                disabled={busy || voice.listening}
                placeholder="Type a message or correction…"
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={!ready || !draft.trim()}
              >
                <Send size={20} />
              </Button>
            </form>
          )}
        </footer>
      )}
    </main>
  );
}
