import { MessageCircle, ArrowUp } from 'lucide-react';
import type { Post } from '../types';
import { formatNumber } from '../lib/reddit';

interface ImageCardProps {
  post: Post;
}

export function ImageCard({ post }: ImageCardProps) {
  const redditLink = `https://www.reddit.com${post.permalink}`;

  return (
    <div
      className="bg-surface-raised border border-border rounded-lg overflow-hidden mb-4"
      style={{ breakInside: 'avoid' }}
    >
      <a href={redditLink} target="_blank" rel="noopener noreferrer" className="block">
        {post.type === 'video' ? (
          <video
            src={post.mediaUrl}
            controls
            loop
            muted
            playsInline
            className="w-full block"
            title={post.title}
          />
        ) : (
          <img src={post.mediaUrl} alt={post.title} loading="lazy" className="w-full block" />
        )}
      </a>

      <div className="p-3">
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
