import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@dak/vite-shared-react/pwa-refresh';
import '@dak/vite-shared-react/hide-cursor';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/maintenance-tracker">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
