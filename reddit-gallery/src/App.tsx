import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spinner } from '@dak/ui';

const Home = lazy(() => import('./pages/Home'));
const Gallery = lazy(() => import('./pages/Gallery'));
const UserGallery = lazy(() => import('./pages/UserGallery'));

export default function App() {
  return (
    <Suspense fallback={<Spinner size="lg" fullScreen />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/r/:subreddit" element={<Gallery />} />
        <Route path="/r/:subreddit/:sort" element={<Gallery />} />
        <Route path="/u/:username" element={<UserGallery />} />
        <Route path="/u/:username/:sort" element={<UserGallery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
