import { useRef } from 'react';
import { MessageCircle, ArrowUp, FileText } from 'lucide-react';
import type { Post } from '../types';
import { formatNumber } from '../lib/reddit';

interface ImageCardProps {
  post: Post;
}

export function ImageCard({ post }: ImageCardProps) {
  const redditLink = `https://www.reddit.com${post.permalink}`;
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoMouseEnter = () => {
    videoRef.current?.play();
  };

  const handleVideoMouseLeave = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <div
      className="bg-surface-raised border border-border rounded-lg overflow-hidden mb-4"
      style={{ breakInside: 'avoid' }}
    >
      {post.type === 'text' ? (
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
      ) : post.type === 'video' ? (
        <a href={redditLink} target="_blank" rel="noopener noreferrer" className="block">
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
      ) : (
        <a href={redditLink} target="_blank" rel="noopener noreferrer" className="block">
          <img src={post.mediaUrl} alt={post.title} loading="lazy" className="w-full block" />
        </a>
      )}

      <div className="p-3">
        <div className="flex items-center gap-1 text-xs text-text-muted mb-1">
          <a
            href={`https://www.reddit.com/user/${post.author}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-accent font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            u/{post.author}
          </a>
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
