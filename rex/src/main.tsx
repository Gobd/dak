import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dak/vite-shared-react/pwa-refresh';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
