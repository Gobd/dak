import { useEffect, useRef, type TouchEvent } from 'react';
import { Button } from '@dak/ui';
import { Clock3, MessageSquare, Plus, RefreshCw, Terminal, X } from 'lucide-react';
import type { TerminalSession } from './api';
import { providers, type Provider } from '../shared/terminal';

interface Props {
  sessions: TerminalSession[];
  sessionId: string;
  connections: Record<Provider, boolean>;
  connected: boolean;
  disabled: boolean;
  overviewActive: boolean;
  blockId: string;
  showOtherTerminals: boolean;
  onShowOtherTerminals: (show: boolean) => void;
  canLaunch: boolean;
  tasksActive: boolean;
  open: boolean;
  onClose: () => void;
  onSelect: (session: string, block: string) => void;
  onOverview: () => void;
  onRefresh: () => void;
  onLaunch: () => void;
  onTasks: () => void;
}

export default function SessionSidebar(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const { open, onClose } = props;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (media.matches) onClose();
    };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, [onClose]);

  function endSwipe(event: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    const end = event.changedTouches[0];
    if (start && end && start.x - end.clientX > 60 && Math.abs(start.y - end.clientY) < 50) {
      onClose();
    }
  }

  const content = (mobile: boolean) => (
    <>
      {mobile && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-3 z-10"
          aria-label="Close sessions"
          onClick={onClose}
        >
          <X size={20} />
        </Button>
      )}
      <nav
        className={`border-b border-border px-3 py-3 ${mobile ? 'pr-12' : ''}`}
        aria-label="App navigation"
      >
        <button
          type="button"
          className="rex-session"
          aria-current={props.overviewActive ? 'page' : undefined}
          disabled={!props.connected || props.disabled}
          onClick={() => {
            props.onOverview();
            onClose();
          }}
        >
          <MessageSquare size={18} />
          <span>Manager</span>
        </button>
        <button
          type="button"
          className="rex-session mb-0"
          aria-current={props.tasksActive ? 'page' : undefined}
          disabled={!props.connected || props.disabled}
          onClick={() => {
            props.onTasks();
            onClose();
          }}
        >
          <Clock3 size={18} />
          <span>Scheduled tasks</span>
        </button>
      </nav>
      <div className="flex items-center justify-between px-4 pb-2 pt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Agents
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh sessions"
          disabled={!props.connected || props.disabled}
          onClick={props.onRefresh}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      <nav className="rex-session-list" aria-label="Sessions">
        {props.sessions.map((session) => {
          const terminals = session.terminals.filter(
            (terminal) => props.showOtherTerminals || terminal.agent !== false,
          );
          if (!terminals.length) return null;
          return (
            <section key={session.session_id} className="mb-4" aria-label={session.label}>
              <h3 className="px-3 pb-2 pt-2 text-xs font-semibold text-text-secondary break-words">
                {session.label}
                {session.provider && (
                  <span className="ml-2 text-[10px] font-normal text-text-muted">
                    {providers[session.provider].label}
                  </span>
                )}
              </h3>
              {terminals.map((terminal, index) => (
                <button
                  type="button"
                  key={terminal.block_id}
                  className="rex-session"
                  aria-current={
                    !props.tasksActive &&
                    !props.overviewActive &&
                    props.sessionId === session.session_id &&
                    props.blockId === terminal.block_id
                      ? 'page'
                      : undefined
                  }
                  disabled={props.disabled}
                  onClick={() => props.onSelect(session.session_id, terminal.block_id)}
                >
                  <Terminal size={17} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">
                      {terminal.label || `Terminal ${index + 1}`}
                    </span>
                    <span className="mt-1 block text-xs font-normal text-text-muted">
                      {terminal.app ||
                        (terminal.agent === false
                          ? 'Shell'
                          : terminal.agent
                            ? 'Agent'
                            : 'Unknown terminal')}
                      {terminal.state ? ` · ${terminal.state}` : ''}
                      {terminals.filter((item) => item.label === terminal.label).length > 1
                        ? ` · Tab ${index + 1}`
                        : ''}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          );
        })}
        {!props.sessions.some((session) =>
          session.terminals.some(
            (terminal) => props.showOtherTerminals || terminal.agent !== false,
          ),
        ) && (
          <p className="px-3 py-4 text-sm text-text-muted">
            {props.connected
              ? 'No agents found. Start an agent or show other terminals.'
              : 'Connect to see your agents.'}
          </p>
        )}
      </nav>
      <label className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={props.showOtherTerminals}
          onChange={(event) => props.onShowOtherTerminals(event.target.checked)}
        />
        Show other terminals
      </label>
      <div className="space-y-4 border-t border-border p-4">
        <Button
          variant="secondary"
          className="w-full"
          disabled={!props.canLaunch || props.disabled}
          onClick={() => {
            props.onLaunch();
            onClose();
          }}
        >
          <Plus size={18} className="mr-2" />
          Start an agent
        </Button>
        <div className="space-y-2">
          {Object.entries(props.connections).map(([provider, online]) => (
            <p key={provider} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className={`h-2 w-2 rounded-full ${online ? 'bg-success' : 'bg-text-muted'}`} />
              {providers[provider as Provider].label} · {online ? 'Connected' : 'Not running'}
            </p>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="rex-sidebar">{content(false)}</aside>
      <dialog
        ref={dialogRef}
        id="rex-session-drawer"
        className="rex-session-drawer"
        aria-label="Sessions"
        onCancel={onClose}
        onClose={() => {
          if (!dialogRef.current?.open) onClose();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={endSwipe}
        onTouchCancel={() => {
          touchStart.current = null;
        }}
      >
        <div className="rex-drawer-content">{content(true)}</div>
      </dialog>
    </>
  );
}
