import { useState, useEffect, useRef, useCallback } from 'react';
import { Users } from 'lucide-react';
import { Input, Toggle } from '@dak/ui';
import { useAuthStore } from '../stores/auth-store';
import { useLocalStorage } from '@dak/hooks';
import { formatNumber } from '../lib/reddit';

interface SubredditResult {
  name: string;
  title: string;
  subscribers: number;
  over18: boolean;
  icon: string | null;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function SubredditTypeahead({ value, onChange, placeholder }: Props) {
  const { apiKey, oauthToken } = useAuthStore();
  const [includeNsfw, setIncludeNsfw] = useLocalStorage('rg-typeahead-nsfw', false);
  const [results, setResults] = useState<SubredditResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMulti = value.includes(',') || value.includes('+');
  const activeSegment = value.split(/[,+]/).pop()?.trim() ?? '';
  const shouldSearch = !isMulti && activeSegment.length >= 3 && !/^\/?(u|user)\//i.test(value);

  const search = useCallback(
    async (q: string) => {
      if (!q) {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (apiKey) headers['X-Reddit-Key'] = apiKey;
        if (oauthToken) headers['X-Reddit-Token'] = oauthToken;
        const res = await fetch(
          `/api/reddit-search?q=${encodeURIComponent(q)}&nsfw=${includeNsfw ? '1' : '0'}`,
          { headers },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { subreddits: SubredditResult[] };
        setResults(json.subreddits ?? []);
        setOpen((json.subreddits ?? []).length > 0);
        setActiveIdx(-1);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, oauthToken, includeNsfw],
  );

  useEffect(() => {
    if (!shouldSearch) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(activeSegment), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeSegment, shouldSearch, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectResult = (name: string) => {
    const parts = value.split(/([,+])/);
    parts[parts.length - 1] = name;
    onChange(parts.join(''));
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectResult(results[activeIdx].name);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Tab' && activeIdx >= 0) {
      e.preventDefault();
      selectResult(results[activeIdx].name);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        className="w-full"
        autoFocus
      />

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-raised border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
            <span className="text-xs text-text-muted">{loading ? 'Searching…' : 'Subreddits'}</span>
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
              Include 18+
              <Toggle checked={includeNsfw} onChange={setIncludeNsfw} />
            </label>
          </div>
          <ul>
            {results.map((sub, i) => (
              <li key={sub.name}>
                <button
                  type="button"
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-sunken cursor-pointer transition-colors ${i === activeIdx ? 'bg-surface-sunken' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectResult(sub.name);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  {sub.icon ? (
                    <img
                      src={sub.icon}
                      alt=""
                      className="w-6 h-6 rounded-full shrink-0 object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <span className="text-accent text-xs font-bold">
                        {sub.name[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-text text-sm font-medium">r/{sub.name}</span>
                    {sub.over18 && (
                      <span className="ml-1.5 text-[10px] text-danger font-semibold">18+</span>
                    )}
                    <p className="text-text-muted text-xs truncate">{sub.title}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                    <Users size={11} />
                    {formatNumber(sub.subscribers)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
