import { useEffect, useRef } from 'react';
import { Button } from '@dak/ui';
import { Volume2 } from 'lucide-react';
import type { TerminalHistory } from './api';

interface Props {
  history?: TerminalHistory;
  loading: boolean;
  name: string;
  canSpeak: boolean;
  onSpeak: (text: string) => void;
  onUnread: (unread: boolean) => void;
}

export default function AgentConversation({
  history,
  loading,
  name,
  canSpeak,
  onSpeak,
  onUnread,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const follow = useRef(true);
  const initialized = useRef(false);
  const latest = useRef('');
  useEffect(() => {
    const content = root.current?.closest('.rex-content');
    if (!content) return;
    const onScroll = () => {
      follow.current = content.scrollHeight - content.scrollTop - content.clientHeight < 120;
      if (follow.current) onUnread(false);
    };
    content.addEventListener('scroll', onScroll);
    return () => content.removeEventListener('scroll', onScroll);
  }, [onUnread]);
  useEffect(() => {
    if (!history) {
      initialized.current = false;
      latest.current = '';
      onUnread(false);
      return;
    }
    const content = root.current?.closest('.rex-content');
    const signature = history.messages.at(-1)?.text || history.output || '';
    if (initialized.current && signature === latest.current) return;
    if (content && (!initialized.current || follow.current)) {
      content.scrollTo({
        top: content.scrollHeight,
        behavior: initialized.current ? 'smooth' : 'instant',
      });
      follow.current = true;
      onUnread(false);
    } else if (signature !== latest.current) {
      onUnread(true);
    }
    latest.current = signature;
    initialized.current = true;
  }, [history, onUnread]);

  return (
    <section ref={root} className="rex-chat" aria-label="Agent conversation">
      {loading && (
        <p className="py-8 text-center text-sm text-text-muted" role="status">
          Loading conversation…
        </p>
      )}
      {history?.truncated && (
        <p className="text-center text-xs text-text-muted">Showing recent history</p>
      )}
      {history?.source === 'scrollback' && (
        <>
          <p className="text-sm text-text-secondary">
            Terminal history · A saved chat transcript isn’t available for this tab.
          </p>
          <pre className="rex-scrollback">
            {history.output || 'This terminal has no output yet.'}
          </pre>
        </>
      )}
      {history?.messages.map((message, index) => (
        <article
          key={`${index}-${message.text.slice(0, 32)}`}
          className={`rex-message ${message.role === 'user' ? 'rex-message-user' : 'rex-message-assistant'}`}
        >
          <p className="rex-message-author">{message.role === 'user' ? 'You' : name}</p>
          <div className="rex-message-bubble">
            <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
            {message.role === 'assistant' && (
              <Button
                variant="ghost"
                size="sm"
                className="rex-read-aloud"
                disabled={!canSpeak}
                onClick={() => onSpeak(message.text)}
              >
                <Volume2 size={14} className="mr-2" />
                Read aloud
              </Button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
