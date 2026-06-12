import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, FileText, User, Moon, Sun } from 'lucide-react';
import { Input, Button, Toggle } from '@dak/ui';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';
import { AuthModal } from '../components/AuthModal';

export default function Home() {
  const [input, setInput] = useState('');
  const [sort, setSort] = useState('hot');
  const [includeText, setIncludeText] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();
  const { apiKey, oauthToken } = useAuthStore();
  const { dark, toggle: toggleDark } = useThemeStore();
  const hasApiKey = !!apiKey;
  const hasToken = !!oauthToken;

  const isUserInput = /^\/?(u|user)\//i.test(input.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    const userMatch = raw.match(/^\/?(u|user)\/(.+)$/i);
    if (userMatch) {
      const username = userMatch[2].trim();
      navigate(`/u/${username}`);
      return;
    }

    const sub = raw
      .replace(/^\/?(r)\//i, '')
      .replace(/\s+/g, '')
      .replace(/,+/g, '+')
      .replace(/\++/g, '+');
    navigate(`/r/${sub}/${sort}${includeText ? '?text=1' : ''}`);
  };

  const authBadge = () => {
    if (hasApiKey && hasToken) {
      return (
        <button
          onClick={() => setShowAuth(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-success/20 text-success text-sm hover:bg-success/30 cursor-pointer"
        >
          Authenticated
        </button>
      );
    }
    if (hasApiKey) {
      return (
        <button
          onClick={() => setShowAuth(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-danger/20 text-danger text-sm hover:bg-danger/30 cursor-pointer"
        >
          No Reddit token
        </button>
      );
    }
    return (
      <button
        onClick={() => setShowAuth(true)}
        className="flex items-center gap-1 px-3 py-1 rounded-full bg-danger/20 text-danger text-sm hover:bg-danger/30 cursor-pointer"
      >
        Not configured
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2 text-text font-semibold">
          <LayoutGrid size={24} />
          <span>Reddit Gallery</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-surface-raised cursor-pointer"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {authBadge()}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <h1 className="text-text text-3xl font-light mb-2">Explore Reddit</h1>
        <p className="text-text-muted mb-8 text-center">
          Enter a subreddit (e.g. <span className="text-text">pics</span>) or user (e.g.{' '}
          <span className="text-text">u/username</span>), or multiple subreddits separated by
          commas.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-lg">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="pics, aww  or  u/username"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full"
              autoFocus
            />
            {isUserInput && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <User size={15} className="text-accent" />
              </span>
            )}
          </div>
          {!isUserInput && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-surface-raised border border-border text-text rounded-lg px-3 py-2 text-sm cursor-pointer"
            >
              <option value="hot">Hot</option>
              <option value="new">New</option>
              <option value="top">Top</option>
              <option value="rising">Rising</option>
            </select>
          )}
          <Button type="submit" disabled={!input.trim()}>
            <Search size={18} />
            Go
          </Button>
        </form>

        {!isUserInput && (
          <label className="flex items-center gap-2 text-text-secondary text-sm cursor-pointer select-none mt-4">
            <FileText size={15} />
            Include text posts
            <Toggle checked={includeText} onChange={setIncludeText} />
          </label>
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
