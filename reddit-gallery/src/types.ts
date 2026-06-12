export interface Post {
  id: string;
  title: string;
  mediaUrl: string;
  type: 'image' | 'video' | 'text';
  permalink: string;
  ups: number;
  numComments: number;
  selftext?: string;
  author: string;
}
