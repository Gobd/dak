import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, FileText, ArrowUpDown, ExternalLink, Moon, Sun } from 'lucide-react';
import { Spinner, Toggle } from '@dak/ui';
import { fetchUserPosts } from '../lib/reddit';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';
import { ImageCard } from '../components/ImageCard';
import { MasonryGrid } from '../components/MasonryGrid';
import { AuthModal } from '../components/AuthModal';
import { JumpBar } from '../components/JumpBar';
import type { Post } from '../types';

export default function UserGallery() {
  const { username = '', sort = 'new' } = useParams<{ username: string; sort?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { apiKey, oauthToken } = useAuthStore();
  const { dark, toggle: toggleDark } = useThemeStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [includeTextOnly, setIncludeTextOnly] = useState(() => searchParams.get('text') === '1');

  const afterRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(
    async (isLoadMore: boolean) => {
      if (loadingRef.current) return;
      if (isLoadMore && !hasMore) return;

      loadingRef.current = true;
      setLoading(true);
      if (!isLoadMore) setError(null);

      try {
        const result = await fetchUserPosts(
          username,
          sort,
          isLoadMore ? afterRef.current : null,
          apiKey,
          oauthToken,
          includeTextOnly,
        );
        afterRef.current = result.after;
        if (!result.after) setHasMore(false);
        setPosts((prev) => (isLoadMore ? [...prev, ...result.posts] : result.posts));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg === 'AUTH_EXPIRED') {
          setTokenExpired(true);
        } else {
          setError(msg);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [username, sort, apiKey, oauthToken, hasMore, includeTextOnly],
  );

  useEffect(() => {
    setPosts([]);
    afterRef.current = null;
    setHasMore(true);
    setTokenExpired(false);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, sort, includeTextOnly, apiKey, oauthToken]);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-text-muted hover:text-text text-sm cursor-pointer"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="flex items-center gap-2 text-text font-semibold">
            <User size={20} />
            <span>u/{username}</span>
          </div>
          <a
            href={`https://www.reddit.com/user/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-text-muted hover:text-accent text-xs"
            title="Open profile on Reddit"
          >
            <ExternalLink size={13} />
            Reddit
          </a>
        </div>
        <JumpBar />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-text-secondary text-sm cursor-pointer select-none">
            <ArrowUpDown size={15} />
            <select
              value={sort}
              onChange={(e) => {
                const newSort = e.target.value;
                const qs = includeTextOnly ? '?text=1' : '';
                navigate(`/u/${username}/${newSort}${qs}`, { replace: true });
              }}
              className="bg-surface-raised border border-border text-text rounded-lg px-2 py-1 text-sm cursor-pointer"
            >
              <option value="new">New</option>
              <option value="hot">Hot</option>
              <option value="top">Top</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-text-secondary text-sm cursor-pointer select-none">
            <FileText size={15} />
            Include text posts
            <Toggle
              checked={includeTextOnly}
              onChange={(val) => {
                setIncludeTextOnly(val);
                setSearchParams(val ? { text: '1' } : {}, { replace: true });
              }}
            />
          </label>
          <button
            onClick={toggleDark}
            className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-surface-raised cursor-pointer"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setShowAuth(true)}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm cursor-pointer ${
              tokenExpired
                ? 'bg-warning/20 text-warning hover:bg-warning/30'
                : apiKey && oauthToken
                  ? 'bg-success/20 text-success hover:bg-success/30'
                  : 'bg-danger/20 text-danger hover:bg-danger/30'
            }`}
          >
            {tokenExpired
              ? 'Token expired'
              : apiKey && oauthToken
                ? 'Authenticated'
                : apiKey
                  ? 'No Reddit token'
                  : 'Not configured'}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {tokenExpired && (
          <div className="mb-4 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center justify-between">
            <span className="text-warning text-sm">Reddit token expired</span>
            <button
              onClick={() => {
                setTokenExpired(false);
                setShowAuth(true);
              }}
              className="text-warning text-sm underline hover:no-underline cursor-pointer"
            >
              Update token
            </button>
          </div>
        )}

        {error && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-16 gap-3">
            <p className="text-danger">{error}</p>
            <button
              onClick={() => setShowAuth(true)}
              className="text-sm text-accent underline hover:no-underline cursor-pointer"
            >
              Add / update credentials
            </button>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="flex items-center justify-center pt-16">
            <p className="text-text-muted">No media posts found for u/{username}</p>
          </div>
        )}

        {posts.length > 0 && (
          <MasonryGrid
            items={posts}
            renderItem={(post) => <ImageCard post={post as Post} mode="user" />}
            hasMore={hasMore}
            onLoadMore={() => load(true)}
          />
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        )}
      </main>

      {showAuth && (
        <AuthModal
          onClose={() => {
            setShowAuth(false);
          }}
        />
      )}
    </div>
  );
}
