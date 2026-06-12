import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowUp, FileText, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import type { Post } from '../types';
import { formatNumber } from '../lib/reddit';

interface ImageCardProps {
  post: Post;
  /** 'subreddit' hides the sub link on single-sub views; 'user' hides the author link */
  mode?: 'subreddit' | 'user' | 'multi';
}

export function ImageCard({ post, mode = 'subreddit' }: ImageCardProps) {
  const redditLink = `https://www.reddit.com${post.permalink}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [galleryIdx, setGalleryIdx] = useState(0);

  // permalink is /r/subname/comments/...
  const postSubreddit = post.permalink.split('/')[2] ?? '';

  const handleVideoMouseEnter = () => {
    videoRef.current?.play();
  };

  const handleVideoMouseLeave = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/u/${post.author}`);
  };

  const galleryImages = post.galleryImages ?? [];
  const galleryTotal = galleryImages.length;

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGalleryIdx((i) => (i - 1 + galleryTotal) % galleryTotal);
  };

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGalleryIdx((i) => (i + 1) % galleryTotal);
  };

  const renderMedia = () => {
    if (post.type === 'text') {
      return (
        <a href={redditLink} target="_blank" rel="noopener noreferrer" className="block p-4">
          <div className="flex items-start gap-2 mb-2">
            <FileText size={16} className="text-text-muted mt-0.5 shrink-0" />
            <p className="text-text text-sm font-medium leading-snug">{post.title}</p>
          </div>
          {post.selftext && (
            <p className="text-text-secondary text-xs line-clamp-4 leading-relaxed">
              {post.selftext}
            </p>
          )}
        </a>
      );
    }

    if (post.type === 'gallery' && galleryTotal > 0) {
      return (
        <div className="relative group">
          <a href={redditLink} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={galleryImages[galleryIdx]}
              alt={`${post.title} (${galleryIdx + 1}/${galleryTotal})`}
              loading="lazy"
              className="w-full block"
            />
          </a>
          {galleryTotal > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight size={20} />
              </button>
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <Images size={12} />
                {galleryIdx + 1}/{galleryTotal}
              </div>
            </>
          )}
        </div>
      );
    }

    if (post.type === 'video') {
      return (
        <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
          <video
            ref={videoRef}
            src={post.mediaUrl}
            loop
            muted
            playsInline
            className="w-full block cursor-pointer"
            title={post.title}
            onMouseEnter={handleVideoMouseEnter}
            onMouseLeave={handleVideoMouseLeave}
          />
        </a>
      );
    }

    return (
      <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img src={post.mediaUrl} alt={post.title} loading="lazy" className="w-full block" />
      </a>
    );
  };

  return (
    <div
      className="bg-surface-raised border border-border rounded-lg overflow-hidden mb-4"
      style={{ breakInside: 'avoid' }}
    >
      {renderMedia()}

      <div className="p-3">
        <div className="flex items-center gap-1 text-xs text-text-muted mb-1 flex-wrap">
          {/* In user mode: show which subreddit this was posted to */}
          {mode === 'user' && postSubreddit && (
            <button
              onClick={() => navigate(`/r/${postSubreddit}`)}
              className="hover:underline hover:text-accent font-medium cursor-pointer"
            >
              r/{postSubreddit}
            </button>
          )}
          {/* In subreddit/multi mode: show author, linkable to user gallery */}
          {mode !== 'user' && (
            <>
              <button
                onClick={handleAuthorClick}
                className="hover:underline hover:text-accent font-medium cursor-pointer"
              >
                u/{post.author}
              </button>
              <span className="text-text-muted/40">·</span>
              <a
                href={`https://www.reddit.com/user/${post.author}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
                onClick={(e) => e.stopPropagation()}
                title="View profile on Reddit"
              >
                ↗
              </a>
            </>
          )}
          {/* In multi-subreddit mode: also show which sub */}
          {mode === 'multi' && postSubreddit && (
            <>
              <span className="text-text-muted/40">in</span>
              <button
                onClick={() => navigate(`/r/${postSubreddit}`)}
                className="hover:underline hover:text-accent cursor-pointer"
              >
                r/{postSubreddit}
              </button>
            </>
          )}
        </div>
        <p className="text-text text-sm font-medium line-clamp-2 mb-2">{post.title}</p>
        <div className="flex items-center gap-4 text-text-muted text-xs">
          <span className="flex items-center gap-1">
            <ArrowUp size={14} />
            {formatNumber(post.ups)}
          </span>
          <a
            href={redditLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-accent"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle size={14} />
            {formatNumber(post.numComments)} comments
          </a>
        </div>
      </div>
    </div>
  );
}
