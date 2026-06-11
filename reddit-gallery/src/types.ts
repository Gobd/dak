export interface Post {
  id: string;
  title: string;
  mediaUrl: string;
  type: 'image' | 'video';
  permalink: string;
  ups: number;
  numComments: number;
}
