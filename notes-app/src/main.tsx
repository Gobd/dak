import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@dak/vite-shared-react/pwa-refresh';
import '@dak/vite-shared-react/hide-cursor';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/notes-app">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
