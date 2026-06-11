import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spinner } from '@dak/ui';

const Home = lazy(() => import('./pages/Home'));
const Gallery = lazy(() => import('./pages/Gallery'));

export default function App() {
  return (
    <Suspense fallback={<Spinner size="lg" fullScreen />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/r/:subreddit" element={<Gallery />} />
        <Route path="/r/:subreddit/:sort" element={<Gallery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
