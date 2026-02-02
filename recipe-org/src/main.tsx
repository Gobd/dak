import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@dak/vite-shared-react/pwa-refresh';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/recipe-org">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
