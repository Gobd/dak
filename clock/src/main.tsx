import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dak/vite-shared-react/hide-cursor';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
