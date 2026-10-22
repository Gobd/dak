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
import {
  providers,
  activityEvent,
  shouldAnnounce,
  type Provider,
  type ActivityTerminal,
  type ActivityEvent,
} from '../shared/terminal';

const selectClass = 'w-full rounded-lg border border-border bg-surface-sunken p-3 text-text';
const initialSettings = {
  managerUrl: '',
  provider: 'rex' as Provider,
  monitor: false,
  review: false,
  autoplay: true,
  voiceURI: '',
  connectedBefore: false,
};

export default function App() {
  const [settings, setSettings] = useLocalStorage('rex-voice-settings', initialSettings);
  const provider = settings.provider || 'rex';
  const terminalApp = providers[provider];
  const [inCall, setInCall] = useState(false);
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const observed = useRef(new Map<string, ActivityEvent>());
  const monitorBusy = useRef(false);
  const preferredBlock = useRef('');
  const [launchTarget, setLaunchTarget] = useState('');
  const [history, setHistory] = useLocalStorage<Message[]>('rex-voice-history', []);
  const [conversationId, setConversationId] = useLocalStorage(
    'rex-voice-conversation',
    crypto.randomUUID(),
  );
  const [connected, setConnected] = useState(false);
  const [managerEnabled, setManagerEnabled] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [sessionId, setSessionId] = useLocalStorage('rex-voice-session', '');
  const [blockId, setBlockId] = useState('');
  const [mode, setMode] = useLocalStorage<'manager' | 'terminal'>('rex-voice-target', 'manager');
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
    <T,>(route: string, body?: unknown) => api<T>(route, body, settings.managerUrl, provider),
    [settings.managerUrl, provider],
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
    setInCall(false);
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
        setBlockId(
          terminals.find((item) => item.block_id === preferredBlock.current)?.block_id ||
            terminals[0]?.block_id ||
            '',
        );
        preferredBlock.current = '';
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
        const response = await request<{
          text: string;
          session?: string;
          block?: string;
          choices?: unknown[];
        }>('chat', {
          message: message.trim(),
          conversation: conversationId,
          block: blockId || undefined,
          history: history
            .slice(-10)
            .map((message) => ({ ...message, text: message.text.slice(-4000) })),
          session: sessionId || undefined,
        });
        setAwaitingChoice(!!response.choices?.length);
        setHistory((previous) =>
          [
            ...previous,
            { role: 'user', text: message.trim() } as Message,
            { role: 'assistant', text: response.text } as Message,
          ].slice(-30),
        );
        if (response.session) {
          await refreshSessions();
          setSessionId(response.session);
          if (response.block) {
            preferredBlock.current = response.block;
            setBlockId(response.block);
          }
        }
        if (settings.autoplay || inCall) voice.speak(response.text);
      }
      setDraft('');
      setShowKeyboard(false);
    } catch (cause) {
      setDraft(message);
      setShowKeyboard(true);
      if (settings.autoplay)
        voice.speak(
          cause instanceof Error
            ? cause.message
            : 'I could not send that message. Please try again.',
        );
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

  const voice = useVoice(
    (transcript) => {
      if (settings.review) {
        setDraft(transcript);
        setShowKeyboard(true);
      } else void sendMessage(transcript);
    },
    settings.voiceURI,
    inCall,
  );

  useEffect(() => {
    if (!inCall || !readyForCall() || voice.listening || voice.speaking || document.hidden) return;
    const timer = window.setTimeout(() => voice.toggleListening(), 500);
    return () => window.clearTimeout(timer);
  }, [
    inCall,
    busy,
    connected,
    showSettings,
    mode,
    settings.review,
    voice.listening,
    voice.speaking,
    voice.toggleListening,
  ]);
  function readyForCall() {
    return (
      connected &&
      managerEnabled &&
      !busy &&
      !showSettings &&
      mode === 'manager' &&
      !settings.review
    );
  }
  useEffect(() => {
    const pauseCall = () => {
      if (document.hidden) setInCall(false);
    };
    document.addEventListener('visibilitychange', pauseCall);
    return () => document.removeEventListener('visibilitychange', pauseCall);
  }, []);
  useEffect(() => {
    if (voice.error) setInCall(false);
  }, [voice.error]);
  useEffect(() => {
    if (!inCall || busy || showSettings) voice.pauseListening();
  }, [inCall, busy, showSettings, voice.pauseListening]);

  async function monitorActivity() {
    if (
      !connected ||
      showSettings ||
      !managerEnabled ||
      (!inCall && !settings.monitor) ||
      busyRef.current ||
      monitorBusy.current ||
      voice.speaking ||
      voice.interim ||
      awaitingChoice ||
      document.hidden
    )
      return;
    monitorBusy.current = true;
    try {
      const result = await request<{ terminals: ActivityTerminal[] }>('activity');
      const active = new Set(result.terminals.map((item) => item.session + '/' + item.block));
      for (const key of observed.current.keys()) if (!active.has(key)) observed.current.delete(key);
      for (const terminal of result.terminals) {
        const key = terminal.session + '/' + terminal.block;
        const previous = observed.current.get(key);
        const event = activityEvent(terminal.records, previous);
        if (!shouldAnnounce(event, previous)) {
          if (event) observed.current.set(key, event);
          else observed.current.delete(key);
          continue;
        }
        if (busyRef.current || voice.interim || document.hidden) break;
        busyRef.current = true;
        setBusy(true);
        voice.pauseListening();
        try {
          const response = await request<{ text: string; choices?: unknown[] }>('chat', {
            message: `${terminal.label} ${event!.message}. Announce this status. If blocked, read its current question and up to five choices.`,
            observation: true,
            conversation: conversationId,
            history: history.slice(-10),
            session: terminal.session,
            block: terminal.block,
          });
          observed.current.set(key, event!);
          preferredBlock.current = terminal.block;
          setSessionId(terminal.session);
          setBlockId(terminal.block);
          setMode('manager');
          setAwaitingChoice(!!response.choices?.length);
          setHistory((previous) =>
            [...previous, { role: 'assistant', text: response.text } as Message].slice(-30),
          );
          if (settings.autoplay || inCall) voice.speak(response.text);
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
        break;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check agent activity.');
    } finally {
      monitorBusy.current = false;
    }
  }
  useInterval(
    () => {
      void monitorActivity();
    },
    connected && (inCall || settings.monitor) ? 5000 : null,
  );

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
      const created = await request<{ session_id: string; block_id?: string }>('launch', {
        preset: presetId,
        session: launchTarget || undefined,
        cwd: launchCwd || undefined,
        label: sessionLabel || undefined,
      });
      await refreshSessions();
      preferredBlock.current = created.block_id || '';
      if (created.session_id === sessionId) {
        const listing = await request<{ blocks: Block[] }>(
          `blocks?session=${encodeURIComponent(created.session_id)}`,
        );
        setBlocks(
          listing.blocks.filter((item) => item.creator_name === 'com.superlogical.terminal'),
        );
        setBlockId(created.block_id || listing.blocks.at(-1)?.block_id || '');
        preferredBlock.current = '';
      }
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
            Agent <span className="text-accent">Voice</span>
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
            <span className="mb-2 block text-sm font-medium">Terminal app</span>
            <select
              className={selectClass}
              value={provider}
              disabled={busy || voice.listening}
              onChange={(event) => {
                voice.stopSpeaking();
                setInCall(false);
                setConnected(false);
                setSessions([]);
                setBlocks([]);
                setSessionId('');
                setBlockId('');
                setScreen('');
                setHistory([]);
                setConversationId(crypto.randomUUID());
                setAwaitingChoice(false);
                setLaunchTarget('');
                observed.current.clear();
                setSettings({ ...settings, provider: event.target.value as Provider });
              }}
            >
              {Object.entries(providers).map(([id, item]) => (
                <option key={id} value={id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
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
              label="Announce agent status while the app is open"
              checked={!!settings.monitor}
              onChange={(monitor) => setSettings({ ...settings, monitor })}
            />
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
              onClick={() => {
                setInCall(false);
                voice.pauseListening();
                setMode('terminal');
              }}
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
              {mode === 'manager'
                ? `${terminalApp.sessionLabel} to discuss`
                : terminalApp.sessionLabel}
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
                <span className="mb-2 block text-sm font-medium">Start in</span>
                <select
                  className={selectClass}
                  value={launchTarget}
                  onChange={(event) => setLaunchTarget(event.target.value)}
                >
                  <option value="">New {terminalApp.sessionLabel.toLowerCase()}</option>
                  {sessions.map((item) => (
                    <option key={item.session_id} value={item.session_id}>
                      New terminal in {item.label}
                    </option>
                  ))}
                </select>
              </label>
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
                    setConversationId(crypto.randomUUID());
                    setAwaitingChoice(false);
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
                  : inCall
                    ? 'Voice call active · waiting for you'
                    : 'Speak and send automatically'}
          </p>
          {mode === 'manager' && (
            <Button
              variant={inCall ? 'primary' : 'secondary'}
              disabled={!managerEnabled || !voice.recognitionSupported || busy || settings.review}
              onClick={() => {
                if (inCall) {
                  setInCall(false);
                  voice.pauseListening();
                  voice.stopSpeaking();
                } else {
                  setInCall(true);
                  setError('');
                }
              }}
            >
              {inCall ? 'End voice call' : 'Start voice call'}
            </Button>
          )}
          <p className="text-center text-xs text-text-muted">
            {terminalApp.label}
            {inCall ? ' · announces agent status and listens between replies' : ''}
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
