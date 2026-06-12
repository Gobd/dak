export interface Post {
  id: string;
  title: string;
  mediaUrl: string;
  type: 'image' | 'video' | 'text' | 'gallery';
  permalink: string;
  ups: number;
  numComments: number;
  selftext?: string;
  author: string;
  /** URLs for multi-image gallery posts */
  galleryImages?: string[];
}
