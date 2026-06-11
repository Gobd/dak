import { create } from 'zustand';

interface AuthState {
  apiKey: string;
  oauthToken: string;
  setCredentials: (apiKey: string, oauthToken: string) => void;
  clearCredentials: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  apiKey: localStorage.getItem('reddit_gallery_api_key') ?? '',
  oauthToken: localStorage.getItem('reddit_gallery_token') ?? '',
  setCredentials: (apiKey, oauthToken) => {
    localStorage.setItem('reddit_gallery_api_key', apiKey);
    localStorage.setItem('reddit_gallery_token', oauthToken);
    set({ apiKey, oauthToken });
  },
  clearCredentials: () => {
    localStorage.removeItem('reddit_gallery_api_key');
    localStorage.removeItem('reddit_gallery_token');
    set({ apiKey: '', oauthToken: '' });
  },
}));
