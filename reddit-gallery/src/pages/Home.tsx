import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutGrid } from 'lucide-react';
import { Input, Button } from '@dak/ui';
import { useAuthStore } from '../stores/auth-store';
import { AuthModal } from '../components/AuthModal';

export default function Home() {
  const [subreddit, setSubreddit] = useState('');
  const [sort, setSort] = useState('hot');
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();
  const { apiKey, oauthToken } = useAuthStore();
  const hasApiKey = !!apiKey;
  const hasToken = !!oauthToken;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sub = subreddit.trim().replace(/\s+/g, '').replace(/,+/g, '+').replace(/\++/g, '+');
    if (!sub) return;
    navigate(`/r/${sub}/${sort}`);
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
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-warning/20 text-warning text-sm hover:bg-warning/30 cursor-pointer"
        >
          No Reddit token
        </button>
      );
    }
    return (
      <button
        onClick={() => setShowAuth(true)}
        className="flex items-center gap-1 px-3 py-1 rounded-full bg-surface-raised text-text-muted text-sm hover:bg-surface-raised/80 cursor-pointer"
      >
        Public only
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
        {authBadge()}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <h1 className="text-text text-3xl font-light mb-2">Explore Subreddits</h1>
        <p className="text-text-muted mb-8">
          Enter a subreddit, or multiple separated by commas, to view a mixed gallery.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-lg">
          <Input
            type="text"
            placeholder="e.g. pics, aww, wallpapers"
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value)}
            className="flex-1"
            autoFocus
          />
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
          <Button type="submit" disabled={!subreddit.trim()}>
            <Search size={18} />
            Go
          </Button>
        </form>
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
