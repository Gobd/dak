import { useCallback, useEffect, useRef, useState } from 'react';
import { useInterval, useLocalStorage } from '@dak/hooks';
import { Button, Input, Toggle } from '@dak/ui';
import {
  Menu,
  Mic,
  PhoneCall,
  PhoneOff,
  Send,
  Settings,
  Square,
  Terminal,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  api,
  managerOrigin,
  type Block,
  type Message,
  type Preset,
  type TerminalSession,
  type TerminalHistory,
} from './api';
import { useVoice } from './useVoice';
import FolderPicker from './FolderPicker';
import Tasks from './Tasks';
import SessionSidebar from './SessionSidebar';
import AgentConversation from './AgentConversation';
import type { TaskRun } from '../shared/tasks';
import type { VoiceDecision, VoiceState } from '../shared/voice';
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
  speechRate: 1,
  connectedBefore: false,
};

export default function App() {
  const [settings, setSettings] = useLocalStorage('rex-voice-settings', initialSettings);
  const provider = 'all';
  const [connections, setConnections] = useState<Record<Provider, boolean>>({
    rex: false,
    cmux: false,
  });
  const [launchProvider, setLaunchProvider] = useState<Provider>('cmux');
  const [inCall, setInCall] = useState(false);
  const inCallRef = useRef(inCall);
  inCallRef.current = inCall;
  const voiceCallId = useRef(crypto.randomUUID());
  const [voiceGate, setVoiceGate] = useState<VoiceState>({
    active: false,
    expiresAt: null,
    timeoutSeconds: 10,
  });
  const voiceQueue = useRef<string[]>([]);
  const [queuedVoice, setQueuedVoice] = useState(0);
  const transcriptChain = useRef(Promise.resolve());
  const voiceRevision = useRef(0);
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
  const [projectsRoot, setProjectsRoot] = useState('');
  const repliesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [pendingMessage, setPendingMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const edgeTouch = useRef<{ x: number; y: number } | null>(null);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [showOtherTerminals, setShowOtherTerminals] = useLocalStorage(
    'rex-show-other-terminals',
    false,
  );
  const [agentSnapshot, setAgentSnapshot] = useState<{
    target: string;
    history: TerminalHistory;
  }>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLive, setHistoryLive] = useState(false);
  const [showScreen, setShowScreen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const agentSpeech = useRef<{ target: string; replies: Set<string> }>({
    target: '',
    replies: new Set(),
  });
  const [agentAttention, setAgentAttention] = useState<{
    target: string;
    text: string;
    choices?: { number: number; label: string }[];
  }>();
  const attentionState = useRef({
    target: '',
    primed: false,
    signature: '',
    conversation: crypto.randomUUID(),
  });
  const attentionBusy = useRef(false);
  const activityPrimed = useRef(false);
  const taskRunsPrimed = useRef(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [sessionId, setSessionId] = useLocalStorage('rex-voice-session', '');
  const [blockId, setBlockId] = useLocalStorage('rex-voice-block', '');
  const [mode, setMode] = useLocalStorage<'manager' | 'terminal'>('rex-voice-target', 'manager');
  const historyTarget = settings.managerUrl + '/' + sessionId + '/' + blockId;
  const agentHistory = agentSnapshot?.target === historyTarget ? agentSnapshot.history : undefined;
  const currentAttention = agentAttention?.target === historyTarget ? agentAttention : undefined;
  const [screen, setScreen] = useState('');
  const [drafts, setDrafts] = useLocalStorage<Record<string, string>>('rex-message-drafts', {});
  const draftKey = mode === 'manager' ? 'overview' : sessionId + '/' + blockId;
  const draft = drafts[draftKey] || '';
  const setDraft = (value: string) => setDrafts((previous) => ({ ...previous, [draftKey]: value }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showLaunch, setShowLaunch] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const attentionTarget = mode === 'terminal' && !showSettings && !showTasks ? historyTarget : '';
  if (attentionState.current.target !== attentionTarget) {
    attentionState.current = {
      target: attentionTarget,
      primed: false,
      signature: '',
      conversation: crypto.randomUUID(),
    };
  }
  const [announcedRuns, setAnnouncedRuns] = useLocalStorage<string[]>('rex-task-announcements', []);
  const [presetId, setPresetId] = useState('');
  const [launchCwd, setLaunchCwd] = useState('');
  const [showFolders, setShowFolders] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');
  const captureBusy = useRef(false);
  const screenRef = useRef<HTMLPreElement>(null);

  const request = useCallback(
    <T,>(route: string, body?: unknown) => api<T>(route, body, settings.managerUrl, provider),
    [settings.managerUrl],
  );

  const refreshSessions = useCallback(async () => {
    const result = await request<{ sessions: TerminalSession[] }>('terminals');
    setSessions(result.sessions);
    setSessionId((current) =>
      mode === 'manager'
        ? ''
        : result.sessions.find(
            (session) =>
              session.session_id === current ||
              session.session_id === current.replace(':', `:${settings.provider || 'rex'}-`),
          )?.session_id || '',
    );
  }, [request, mode, settings.provider]);
  useInterval(
    () => {
      if (connected && !busyRef.current && !document.hidden) {
        void refreshSessions().catch((cause: Error) => setError(cause.message));
      }
    },
    connected ? 15000 : null,
  );

  async function connect() {
    if (busyRef.current) return;
    busyRef.current = true;
    attemptedConnection.current = true;
    setInCall(false);
    activityPrimed.current = false;
    taskRunsPrimed.current = false;
    observed.current.clear();
    setBusy(true);
    setError('');
    try {
      managerOrigin(settings.managerUrl);
      const [status, launchers] = await Promise.all([
        request<{
          connected: boolean;
          managerEnabled: boolean;
          projectsRoot?: string;
          connections: Record<Provider, boolean>;
        }>('status'),
        request<{ presets: Preset[] }>('presets'),
      ]);
      if (!status.connected) throw new Error('Open Rex or cmux on your Mac, then connect again.');
      setConnections(status.connections);
      setLaunchProvider(status.connections.cmux ? 'cmux' : 'rex');
      await refreshSessions();
      setManagerEnabled(status.managerEnabled);
      setProjectsRoot(status.projectsRoot || '');
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
    const terminals = sessions.find((session) => session.session_id === sessionId)?.terminals || [];
    setBlocks(terminals);
    const preferred = preferredBlock.current;
    setBlockId(
      (current) =>
        terminals.find((item) => item.block_id === (preferred || current))?.block_id ||
        terminals[0]?.block_id ||
        '',
    );
    preferredBlock.current = '';
  }, [connected, sessionId, sessions]);

  const refreshScreen = useCallback(async () => {
    if (
      !connected ||
      !sessionId ||
      !blockId ||
      !showScreen ||
      captureBusy.current ||
      document.hidden
    )
      return;
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
  }, [connected, sessionId, blockId, request, showScreen]);

  useEffect(() => {
    setScreen('');
    void refreshScreen();
  }, [refreshScreen]);
  useInterval(
    () => {
      void refreshScreen();
    },
    connected && mode === 'terminal' && showScreen ? 3000 : null,
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

  useEffect(() => {
    if (mode === 'manager' && connected && !showSettings && !showTasks) {
      const content = repliesRef.current;
      content?.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
    }
  }, [history, pendingMessage, mode, connected, showSettings, showTasks]);

  async function sendMessage(message: string, voiceCall?: string) {
    if (!message.trim() || busyRef.current || !ready) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    voice.stopSpeaking();
    try {
      if (mode === 'terminal') {
        if (currentAttention && managerEnabled) {
          const target = historyTarget;
          const response = await request<{
            text: string;
            choices?: { number: number; label: string }[];
          }>('chat', {
            message: message.trim(),
            terminalOnly: true,
            voiceCall,
            conversation: attentionState.current.conversation,
            session: sessionId,
            block: blockId,
            history: [],
          });
          if (attentionState.current.target === target) {
            setAgentAttention({ target, text: response.text, choices: response.choices });
            if (settings.autoplay || inCall) voice.speak(response.text);
          }
        } else
          await request('send', { session: sessionId, block: blockId, message: message.trim() });
        await refreshScreen();
      } else {
        setPendingMessage(message.trim());
        const response = await request<{
          text: string;
          session?: string;
          block?: string;
          choices?: unknown[];
        }>('chat', {
          voiceCall,
          message: message.trim(),
          conversation: conversationId,
          block: blockId || undefined,
          history: history
            .slice(-10)
            .map((message) => ({ ...message, text: message.text.slice(-4000) })),
          session: sessionId || undefined,
        });
        setAwaitingChoice(!!response.choices?.length);
        setPendingMessage('');
        setHistory((previous) =>
          [
            ...previous,
            { role: 'user', text: message.trim() } as Message,
            { role: 'assistant', text: response.text } as Message,
          ].slice(-30),
        );
        if (response.session) {
          await refreshSessions();
          // Keep Overview selected; a manager action may reference an agent without changing the page.
        }
        if (settings.autoplay || inCall) voice.speak(response.text);
      }
      setDraft('');
    } catch (cause) {
      setDraft(message);
      composerRef.current?.focus();
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
      setPendingMessage('');
      busyRef.current = false;
      setBusy(false);
    }
  }

  function receiveVoiceTranscript(transcript: string) {
    const call = voiceCallId.current;
    transcriptChain.current = transcriptChain.current
      .then(async () => {
        if (!inCallRef.current || call !== voiceCallId.current) return;
        voiceRevision.current++;
        const decision = await request<VoiceDecision>('voice/transcript', { call, transcript });
        if (!inCallRef.current || call !== voiceCallId.current) return;
        setVoiceGate(decision);
        if (!decision.active) {
          voiceQueue.current = [];
          setQueuedVoice(0);
          setAwaitingChoice(false);
          voice.stopSpeaking();
        } else if (decision.message) {
          voiceQueue.current.push(decision.message);
          setQueuedVoice(voiceQueue.current.length);
        }
      })
      .catch((cause) => {
        if (!inCallRef.current || call !== voiceCallId.current) return;
        setError(
          cause instanceof Error ? cause.message : 'Could not check the voice conversation.',
        );
        setInCall(false);
      });
  }

  const voice = useVoice(
    (transcript) => {
      if (inCallRef.current) {
        receiveVoiceTranscript(transcript);
      } else if (settings.review) {
        setDraft(transcript);
        composerRef.current?.focus();
      } else void sendMessage(transcript);
    },
    settings.voiceURI,
    inCall,
    settings.speechRate || 1,
  );

  useEffect(() => {
    if (!inCall || !voiceGate.active || busy || !queuedVoice || voice.speaking) return;
    const message = voiceQueue.current.shift();
    setQueuedVoice(voiceQueue.current.length);
    if (message) void sendMessage(message, voiceCallId.current);
  }, [inCall, voiceGate.active, busy, queuedVoice, voice.speaking]);

  useEffect(() => {
    if (!inCall) return;
    const call = voiceCallId.current;
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      const revision = voiceRevision.current;
      try {
        const state = await request<VoiceState>(`voice/state?call=${call}`);
        if (cancelled || revision !== voiceRevision.current) return;
        setVoiceGate(state);
        if (!state.active) {
          voiceQueue.current = [];
          setQueuedVoice(0);
          setAwaitingChoice(false);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Voice connection lost.');
          setInCall(false);
        }
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      voiceQueue.current = [];
      setQueuedVoice(0);
      void request('voice/end', { call }).catch(() => {});
    };
  }, [inCall, request]);

  useEffect(() => {
    if (!inCall) return;
    const call = voiceCallId.current;
    const speaking = voice.speaking;
    voiceRevision.current++;
    transcriptChain.current = transcriptChain.current
      .then(async () => {
        if (!inCallRef.current || call !== voiceCallId.current) return;
        const state = await request<VoiceState>('voice/playback', { call, speaking });
        if (inCallRef.current && call === voiceCallId.current) setVoiceGate(state);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not update voice playback.');
        setInCall(false);
      });
  }, [inCall, voice.speaking, request]);

  useEffect(() => {
    if (!inCall || !readyForCall() || voice.listening || document.hidden) return;
    const timer = window.setTimeout(() => voice.toggleListening(), 500);
    return () => window.clearTimeout(timer);
  }, [
    inCall,
    busy,
    connected,
    showSettings,
    showTasks,
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
      !showSettings &&
      !showTasks &&
      (mode === 'manager' || !!blockId) &&
      !settings.review
    );
  }
  function toggleVoiceCall() {
    if (inCall) {
      setInCall(false);
      voice.pauseListening();
      voice.stopSpeaking();
    } else {
      voiceCallId.current = crypto.randomUUID();
      setVoiceGate({ active: false, expiresAt: null, timeoutSeconds: voiceGate.timeoutSeconds });
      setInCall(true);
      setError('');
    }
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
    if (!inCall || showSettings || showTasks) voice.pauseListening();
  }, [inCall, showSettings, showTasks, mode, voice.pauseListening]);

  async function readAgentOptions(announce = true) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const state = attentionState.current;
    const target = state.target;
    try {
      const response = await request<{
        text: string;
        choices?: { number: number; label: string }[];
      }>('chat', {
        message:
          'The selected agent is waiting for input. Briefly explain what is blocked and read up to five current choices. Use concise option labels, not the full command or log.',
        observation: true,
        terminalOnly: true,
        conversation: state.conversation,
        session: sessionId,
        block: blockId,
        history: [],
      });
      if (attentionState.current !== state) return;
      setAgentAttention({ target, text: response.text, choices: response.choices });
      if (announce && (settings.autoplay || inCall)) voice.speak(response.text);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function monitorTerminalAttention() {
    if (
      !connected ||
      mode !== 'terminal' ||
      !sessionId ||
      !blockId ||
      showSettings ||
      showTasks ||
      busyRef.current ||
      attentionBusy.current ||
      voice.speaking ||
      voice.interim ||
      document.hidden
    )
      return;
    attentionBusy.current = true;
    const state = attentionState.current;
    try {
      const result = await request<{ terminals: ActivityTerminal[] }>(
        `activity?session=${encodeURIComponent(sessionId)}&block=${encodeURIComponent(blockId)}`,
      );
      if (attentionState.current !== state) return;
      setError((previous) =>
        previous === 'This app origin is not configured on the manager.' ? '' : previous,
      );
      const event = activityEvent(result.terminals[0]?.records || []);
      const initial = !state.primed;
      state.primed = true;
      if (event?.state !== 'blocked') {
        state.signature = '';
        setAgentAttention(undefined);
        return;
      }
      if (state.signature === event.signature) return;
      state.signature = event.signature;
      setAgentAttention({
        target: state.target,
        text: 'This agent is waiting for your input. Read its current options to answer.',
      });
      // Existing waits are visible but silent on opening/switching tabs.
      if (managerEnabled) await readAgentOptions(!initial);
    } catch (cause) {
      if (attentionState.current === state) {
        state.signature = '';
        setError(cause instanceof Error ? cause.message : 'Could not read the agent’s question.');
      }
    } finally {
      attentionBusy.current = false;
    }
  }
  useInterval(
    () => {
      void monitorTerminalAttention();
    },
    connected && mode === 'terminal' ? 2000 : null,
  );

  async function monitorActivity() {
    if (
      !connected ||
      mode !== 'manager' ||
      showSettings ||
      showTasks ||
      !managerEnabled ||
      (!(inCall && voiceGate.active) && !settings.monitor) ||
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
      setError((previous) =>
        previous === 'This app origin is not configured on the manager.' ? '' : previous,
      );
      if (!activityPrimed.current) {
        for (const terminal of result.terminals) {
          const event = activityEvent(terminal.records);
          if (event) observed.current.set(terminal.session + '/' + terminal.block, event);
        }
        activityPrimed.current = true;
        return;
      }
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
        if (!inCall) voice.pauseListening();
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
          // Status announcements belong to Overview and do not switch the selected agent.
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

  function announceTaskRuns(runs: TaskRun[]) {
    if (!taskRunsPrimed.current) {
      taskRunsPrimed.current = true;
      setAnnouncedRuns((previous) =>
        [
          ...new Set([
            ...previous,
            ...runs.filter((run) => run.status !== 'running').map((run) => run.id),
          ]),
        ].slice(-2000),
      );
      return;
    }
    if (
      busyRef.current ||
      monitorBusy.current ||
      voice.speaking ||
      voice.interim ||
      awaitingChoice ||
      document.hidden ||
      showSettings ||
      (!settings.autoplay && !inCall)
    )
      return;
    const run = runs.find((item) => item.status !== 'running' && !announcedRuns.includes(item.id));
    if (!run) return;
    const text =
      run.label +
      (run.status === 'succeeded' ? ' finished. ' : ' failed. ') +
      (run.error || run.output).slice(-1200);
    setAnnouncedRuns((previous) => [...previous, run.id].slice(-2000));
    setHistory((previous) => [...previous, { role: 'assistant', text } as Message].slice(-30));
    if (!inCall) voice.pauseListening();
    voice.speak(text);
  }

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
        provider: launchProvider,
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

  useEffect(() => {
    if (!connected || mode !== 'terminal' || !sessionId || !blockId || showSettings || showTasks) {
      setAgentSnapshot(undefined);
      setHistoryLoading(false);
      return;
    }
    agentSpeech.current = { target: '', replies: new Set() };
    setAgentSnapshot(undefined);
    setHistoryLoading(true);
    setHistoryLive(false);
    const url = new URL(
      `${managerOrigin(settings.managerUrl) || window.location.origin}/rex/api/history/events`,
    );
    url.searchParams.set('provider', 'all');
    url.searchParams.set('session', sessionId);
    url.searchParams.set('block', blockId);
    const events = new EventSource(url);
    let initial = true;
    let conversationId: string | undefined;
    let source: TerminalHistory['source'] | undefined;
    let closed = false;
    const onHistory = (event: MessageEvent) => {
      if (closed) return;
      try {
        const history = JSON.parse(event.data) as TerminalHistory;
        if (initial || history.conversationId !== conversationId || history.source !== source) {
          initial = false;
          conversationId = history.conversationId;
          source = history.source;
          agentSpeech.current = {
            target: historyTarget,
            replies: new Set(
              history.messages
                .filter((message) => message.role === 'assistant' && message.phase !== 'commentary')
                .map((message) => message.text),
            ),
          };
        }
        setAgentSnapshot({ target: historyTarget, history });
        setHistoryLoading(false);
        setHistoryLive(true);
      } catch {
        setHistoryLive(false);
      }
    };
    events.addEventListener('history', onHistory);
    events.addEventListener('unavailable', () => {
      setHistoryLive(false);
      setHistoryLoading(false);
    });
    events.onopen = () => {
      initial = true;
      setHistoryLive(true);
    };
    events.onerror = () => {
      setHistoryLive(false);
      setHistoryLoading(false);
    };
    return () => {
      closed = true;
      events.close();
    };
  }, [settings.managerUrl, connected, mode, sessionId, blockId, showSettings, showTasks]);

  useEffect(() => {
    if (!agentHistory || mode !== 'terminal') return;
    const target = historyTarget;
    const replies = agentHistory.messages
      .filter((message) => message.role === 'assistant' && message.phase !== 'commentary')
      .map((message) => message.text);
    if (agentSpeech.current.target !== target) {
      agentSpeech.current = { target, replies: new Set(replies) };
      return;
    }
    const reply = replies.filter((text) => !agentSpeech.current.replies.has(text)).at(-1);
    if (!reply) return;
    if ((settings.autoplay || inCall) && voice.speaking) return;
    for (const text of replies) agentSpeech.current.replies.add(text);
    if (settings.autoplay || inCall) voice.speak(reply);
  }, [
    agentHistory,
    historyTarget,
    mode,
    provider,
    sessionId,
    blockId,
    settings.autoplay,
    inCall,
    voice.speaking,
    voice.speak,
  ]);

  const ready =
    connected &&
    !busy &&
    !showSettings &&
    !showTasks &&
    (mode === 'manager' ? managerEnabled : !!blockId);
  const chosenPreset = presets.find((preset) => preset.id === presetId);

  const selectedSession = sessions.find((session) => session.session_id === sessionId);
  const selectedTerminal = selectedSession?.terminals.find(
    (terminal) => terminal.block_id === blockId,
  );

  return (
    <main
      className="rex-shell"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        edgeTouch.current =
          touch && touch.clientX <= 28 && !sidebarOpen && window.innerWidth < 768
            ? { x: touch.clientX, y: touch.clientY }
            : null;
      }}
      onTouchEnd={(event) => {
        const start = edgeTouch.current;
        edgeTouch.current = null;
        const end = event.changedTouches[0];
        if (start && end && end.clientX - start.x > 60 && Math.abs(end.clientY - start.y) < 50) {
          setSidebarOpen(true);
        }
      }}
      onTouchCancel={() => {
        edgeTouch.current = null;
      }}
    >
      <SessionSidebar
        sessions={sessions}
        sessionId={sessionId}
        connections={connections}
        connected={connected}
        disabled={busy || voice.listening}
        overviewActive={mode === 'manager' && !showTasks && !showSettings}
        blockId={blockId}
        showOtherTerminals={showOtherTerminals}
        onShowOtherTerminals={setShowOtherTerminals}
        canLaunch={connected && !!presets.length}
        tasksActive={showTasks && !showSettings}
        open={sidebarOpen}
        onClose={closeSidebar}
        onSelect={(id, terminal) => {
          preferredBlock.current = '';
          setInCall(false);
          voice.pauseListening();
          voice.stopSpeaking();
          setError('');
          setMode('terminal');
          setBlockId(terminal);
          setShowScreen(false);
          setShowTasks(false);
          setShowSettings(false);
          setSessionId(id);
          closeSidebar();
        }}
        onOverview={() => {
          setInCall(false);
          voice.pauseListening();
          voice.stopSpeaking();
          setShowTasks(false);
          setShowSettings(false);
          setMode('manager');
          setSessionId('');
          setBlockId('');
        }}
        onRefresh={() => void refreshSessions().catch((cause: Error) => setError(cause.message))}
        onLaunch={() => {
          setShowTasks(false);
          setShowSettings(false);
          setShowLaunch(!showLaunch);
        }}
        onTasks={() => {
          setInCall(false);
          voice.pauseListening();
          voice.stopSpeaking();
          setShowSettings(false);
          setShowLaunch(false);
          setShowTasks(true);
        }}
      />
      <div className="rex-workspace">
        <header className="rex-header">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rex-menu-button"
              aria-label="Open sessions"
              aria-expanded={sidebarOpen}
              aria-controls="rex-session-drawer"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-lg font-semibold">
                {showSettings
                  ? 'Settings'
                  : showTasks
                    ? 'Scheduled tasks'
                    : mode === 'manager'
                      ? 'Manager'
                      : selectedTerminal?.label || 'Choose an agent'}
              </h1>
              {!showSettings && !showTasks && mode === 'terminal' && selectedSession?.provider && (
                <span className="shrink-0 rounded-md bg-surface-sunken px-2 py-1 text-xs text-text-secondary">
                  {providers[selectedSession.provider].label}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {voice.speaking && (
              <Button
                variant="secondary"
                size="sm"
                aria-label="Stop voice playback"
                onClick={voice.stopSpeaking}
              >
                <VolumeX size={16} className="mr-2" />
                Stop playback
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              aria-pressed={showSettings}
              disabled={busy || voice.listening}
              onClick={() => {
                voice.stopSpeaking();
                setShowSettings(!showSettings);
              }}
            >
              <Settings size={21} />
            </Button>
          </div>
        </header>
        <div ref={repliesRef} className="rex-content">
          <div className="rex-content-inner">
            {showSettings && (
              <section
                className="space-y-5 rounded-xl border border-border bg-surface-raised p-5"
                aria-label="Connection and voice settings"
              >
                <p className="text-sm text-text-secondary">
                  Rex and cmux are discovered automatically. Select an agent in the sidebar to talk
                  directly to its terminal.
                </p>
                {!!history.length && (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Clear conversation"
                    onClick={() => {
                      voice.stopSpeaking();
                      setHistory([]);
                      setConversationId(crypto.randomUUID());
                      setAwaitingChoice(false);
                    }}
                  >
                    <Trash2 size={16} className="mr-2" />
                    Clear manager conversation
                  </Button>
                )}
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
                  On this Mac, leave blank for the dev proxy or use http://localhost:5184. For
                  Android over WireGuard, use your private HTTPS address.
                </p>
                {projectsRoot && (
                  <p className="break-all text-sm text-text-secondary">
                    Project search root: {projectsRoot}
                  </p>
                )}
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
                    label="Read manager and agent replies aloud"
                    checked={settings.autoplay}
                    onChange={(autoplay) => setSettings({ ...settings, autoplay })}
                  />
                </div>
                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-sm font-medium">
                    Playback speed <span>{(settings.speechRate || 1).toFixed(1)}×</span>
                  </span>
                  <input
                    type="range"
                    className="w-full accent-accent"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={settings.speechRate || 1}
                    onChange={(event) =>
                      setSettings({ ...settings, speechRate: Number(event.target.value) })
                    }
                  />
                  <span className="mt-1 flex justify-between text-xs text-text-muted">
                    <span>0.5×</span>
                    <span>1× default</span>
                    <span>2×</span>
                  </span>
                </label>
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
                  Chrome may use an online speech service for recognition. Only the final transcript
                  is sent to your Mac.
                </p>
                <Button loading={busy} onClick={() => void connect()}>
                  {connected ? 'Reconnect' : 'Connect'}
                </Button>
              </section>
            )}

            {connected && !showSettings && (
              <Tasks
                key={settings.managerUrl}
                request={request}
                visible={showTasks}
                onRuns={announceTaskRuns}
              />
            )}
            {connected && !showSettings && !showTasks && (
              <>
                {showLaunch && (
                  <section
                    className="space-y-3 rounded-xl border border-border bg-surface-raised p-4"
                    aria-label="Start an agent"
                  >
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium">
                        Terminal app for the new agent
                      </span>
                      <select
                        className={selectClass}
                        value={launchProvider}
                        onChange={(event) => {
                          setLaunchProvider(event.target.value as Provider);
                          setLaunchTarget('');
                        }}
                      >
                        {Object.entries(connections)
                          .filter(([, online]) => online)
                          .map(([app]) => (
                            <option key={app} value={app}>
                              {providers[app as Provider].label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium">Start in</span>
                      <select
                        className={selectClass}
                        value={launchTarget}
                        onChange={(event) => setLaunchTarget(event.target.value)}
                      >
                        <option value="">
                          New {providers[launchProvider].sessionLabel.toLowerCase()}
                        </option>
                        {sessions
                          .filter((item) => item.provider === launchProvider)
                          .map((item) => (
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
                      <span className="mb-2 block text-sm font-medium">
                        Session name (optional)
                      </span>
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
                  <section className="rex-terminal space-y-3">
                    {currentAttention && (
                      <section
                        className="rounded-xl border border-border bg-surface-raised p-4"
                        aria-label="Agent needs attention"
                      >
                        <p className="mb-2 font-semibold">Waiting for your answer</p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {currentAttention.text}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentAttention.choices?.map((choice) => (
                            <Button
                              key={choice.number}
                              variant="secondary"
                              size="sm"
                              disabled={busy || voice.listening}
                              onClick={() => void sendMessage(choice.label)}
                            >
                              {choice.label}
                            </Button>
                          ))}
                          {managerEnabled && !currentAttention.choices?.length && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy || attentionBusy.current}
                              onClick={() =>
                                void readAgentOptions().catch((cause) =>
                                  setError(
                                    cause instanceof Error
                                      ? cause.message
                                      : 'Could not read options.',
                                  ),
                                )
                              }
                            >
                              Read current options
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-text-muted">
                          Tap the microphone and say an option name, such as “approve” or “decline.”
                        </p>
                      </section>
                    )}
                    <AgentConversation
                      history={agentHistory}
                      loading={historyLoading}
                      name={selectedTerminal?.app || 'Agent'}
                      onSpeak={voice.speak}
                      canSpeak={voice.synthesisSupported && !voice.listening}
                      onUnread={setHasNewMessages}
                    />
                    {showScreen && (
                      <section
                        id="rex-live-terminal"
                        aria-label="Live terminal and keys"
                        className="rex-terminal-details"
                      >
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
                          Messages are sent directly to this terminal and submitted with Return.
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
                          className="rex-terminal-screen min-h-48 overflow-auto whitespace-pre rounded-xl border border-border bg-surface-sunken p-4 font-mono text-xs leading-relaxed"
                          aria-label="Live terminal screen"
                        >
                          {screen || 'Waiting for terminal output…'}
                        </pre>
                        <div className="flex justify-between text-xs text-text-muted">
                          <span>Current screen · refreshes every 3 seconds</span>
                          <button
                            type="button"
                            className="text-accent"
                            onClick={() => void refreshScreen()}
                          >
                            Refresh
                          </button>
                        </div>
                      </section>
                    )}
                  </section>
                ) : (
                  <section className="rex-chat" aria-label="Conversation">
                    {!managerEnabled && (
                      <p className="rounded-xl bg-surface-sunken p-4 text-text-secondary">
                        Manager chat isn’t configured yet. You can use Agent terminal to talk to an
                        existing agent.
                      </p>
                    )}
                    {managerEnabled && !history.length && !pendingMessage && (
                      <div className="rex-chat-empty">
                        <span className="rex-brand-mark">
                          <Terminal size={24} />
                        </span>
                        <h2 className="text-xl font-semibold">What are we working on?</h2>
                        <p className="max-w-sm text-sm text-text-secondary">
                          Ask what your agents are doing, start something new, or pick a session
                          from the sidebar.
                        </p>
                      </div>
                    )}
                    {history.map((message, index) => (
                      <article
                        key={`${index}-${message.text.slice(0, 32)}`}
                        className={`rex-message ${message.role === 'user' ? 'rex-message-user' : 'rex-message-assistant'}`}
                      >
                        <p className="rex-message-author">
                          {message.role === 'user' ? 'You' : 'Rex'}
                        </p>
                        <div className="rex-message-bubble">
                          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                          {message.role === 'assistant' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rex-read-aloud"
                              disabled={!voice.synthesisSupported || voice.listening}
                              onClick={() => voice.speak(message.text)}
                            >
                              <Volume2 size={14} className="mr-2" />
                              Read aloud
                            </Button>
                          )}
                        </div>
                      </article>
                    ))}
                    {pendingMessage && (
                      <>
                        <article className="rex-message rex-message-user">
                          <p className="rex-message-author">You</p>
                          <div className="rex-message-bubble">
                            <p className="whitespace-pre-wrap leading-relaxed">{pendingMessage}</p>
                          </div>
                        </article>
                        <p className="text-sm text-text-muted" role="status">
                          Rex is thinking…
                        </p>
                      </>
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
          </div>
        </div>
        {connected && !showSettings && !showTasks && (
          <footer className="rex-composer">
            <form
              className={`rex-composer-box ${draft ? 'rex-composer-has-text' : ''}`}
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(draft);
              }}
            >
              <label className="sr-only" htmlFor="rex-message">
                Message
              </label>
              <textarea
                ref={composerRef}
                id="rex-message"
                rows={1}
                maxLength={8000}
                value={draft}
                disabled={busy || (voice.listening && !inCall)}
                placeholder={
                  mode === 'manager'
                    ? 'Ask the manager…'
                    : `Message ${selectedTerminal?.app || 'terminal'}…`
                }
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing &&
                    window.matchMedia('(min-width: 768px)').matches
                  ) {
                    event.preventDefault();
                    void sendMessage(draft);
                  }
                }}
              />
              <div className="rex-composer-actions">
                <Button
                  variant={inCall ? 'primary' : 'ghost'}
                  size="icon"
                  disabled={!inCall && (!readyForCall() || !voice.recognitionSupported || busy)}
                  aria-label={inCall ? 'End voice call' : 'Start voice call'}
                  title={inCall ? 'End voice call' : 'Start voice call · say “Hey Rex” to talk'}
                  aria-pressed={inCall}
                  onClick={toggleVoiceCall}
                >
                  {inCall ? <PhoneOff size={20} /> : <PhoneCall size={20} />}
                </Button>
                {mode === 'terminal' && (
                  <Button
                    variant={showScreen ? 'primary' : 'ghost'}
                    size="icon"
                    aria-label={showScreen ? 'Hide terminal and keys' : 'Show terminal and keys'}
                    title={showScreen ? 'Hide terminal and keys' : 'Show terminal and keys'}
                    aria-expanded={showScreen}
                    aria-controls="rex-live-terminal"
                    onClick={() => setShowScreen(!showScreen)}
                  >
                    <Terminal size={20} />
                  </Button>
                )}
                <Button
                  variant={voice.listening ? 'primary' : 'ghost'}
                  size="icon"
                  disabled={!ready || !voice.recognitionSupported}
                  aria-label={voice.listening ? 'Finish speaking' : 'Speak a message'}
                  aria-pressed={voice.listening}
                  onClick={voice.toggleListening}
                >
                  {voice.listening ? <Square size={20} /> : <Mic size={20} />}
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={!ready || !draft.trim()}
                >
                  <Send size={19} />
                </Button>
              </div>
            </form>
            <div className="rex-composer-status">
              <p className="text-xs text-text-secondary" role="status">
                {inCall
                  ? voiceGate.active
                    ? busy
                      ? 'Rex is working · conversation active'
                      : 'Rex is ready · say “Thanks Rex” when finished'
                    : 'Listening for “Hey Rex”'
                  : busy
                    ? 'Working…'
                    : voice.listening
                      ? 'Listening… tap to finish'
                      : settings.review
                        ? 'Speak, review, then send'
                        : mode === 'terminal'
                          ? `Direct to ${selectedTerminal?.app || 'terminal'} · ${historyLoading ? 'Loading' : historyLive ? 'Live' : 'Reconnecting…'}`
                          : 'Type a message or tap the microphone'}
              </p>
              {hasNewMessages && mode === 'terminal' && (
                <button
                  type="button"
                  className="text-xs font-medium text-accent"
                  onClick={() => {
                    repliesRef.current?.scrollTo({
                      top: repliesRef.current.scrollHeight,
                      behavior: 'smooth',
                    });
                    setHasNewMessages(false);
                  }}
                >
                  New messages ↓
                </button>
              )}
              <span className="rex-keyboard-hint text-xs text-text-muted">
                Enter to send · Shift+Enter for a new line
              </span>
            </div>
            {!voice.recognitionSupported && (
              <p className="mt-1 text-xs text-text-muted">
                Microphone unavailable. Use Chrome over HTTPS, or type a message.
              </p>
            )}
          </footer>
        )}
      </div>
    </main>
  );
}
