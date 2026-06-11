import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { Spinner } from '@dak/ui';
import { fetchPosts } from '../lib/reddit';
import { useAuthStore } from '../stores/auth-store';
import { ImageCard } from '../components/ImageCard';
import { MasonryGrid } from '../components/MasonryGrid';
import { AuthModal } from '../components/AuthModal';
import type { Post } from '../types';

export default function Gallery() {
  const { subreddit = '', sort = 'hot' } = useParams<{ subreddit: string; sort?: string }>();
  const navigate = useNavigate();
  const { apiKey, oauthToken } = useAuthStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  const afterRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (isLoadMore: boolean) => {
      if (loadingRef.current) return;
      if (isLoadMore && !hasMore) return;

      loadingRef.current = true;
      setLoading(true);
      if (!isLoadMore) setError(null);

      try {
        const result = await fetchPosts(
          subreddit,
          sort,
          isLoadMore ? afterRef.current : null,
          apiKey,
          oauthToken,
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
    [subreddit, sort, apiKey, oauthToken, hasMore],
  );

  // Reset and fetch fresh when subreddit/sort changes
  useEffect(() => {
    setPosts([]);
    afterRef.current = null;
    setHasMore(true);
    setTokenExpired(false);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subreddit, sort]);

  // Infinite scroll via IntersectionObserver on sentinel div
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loadingRef.current) {
        load(true);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, load]);

  const displayName = subreddit.replace(/\+/g, ' + ');

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
            <LayoutGrid size={20} />
            <span>r/{displayName}</span>
          </div>
        </div>
        <button
          onClick={() => setShowAuth(true)}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm cursor-pointer ${
            apiKey && oauthToken
              ? 'bg-success/20 text-success hover:bg-success/30'
              : apiKey
                ? 'bg-danger/20 text-danger hover:bg-danger/30'
                : 'bg-danger/20 text-danger hover:bg-danger/30'
          }`}
        >
          {apiKey && oauthToken ? 'Authenticated' : apiKey ? 'No Reddit token' : 'Not configured'}
        </button>
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
              className="text-warning text-sm underline hover:no-underline"
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
            <p className="text-text-muted">No media posts found in r/{subreddit}</p>
          </div>
        )}

        {posts.length > 0 && (
          <MasonryGrid>
            {posts.map((post) => (
              <ImageCard key={post.id} post={post} />
            ))}
          </MasonryGrid>
        )}

        <div ref={sentinelRef} className="h-1" />

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
            setPosts([]);
            afterRef.current = null;
            setHasMore(true);
            load(false);
          }}
        />
      )}
    </div>
  );
}
