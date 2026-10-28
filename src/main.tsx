import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initInstallPrompt } from '@/lib/install';
import { initPwa } from '@/lib/pwa';

// Register the service worker and capture the Android/Chrome install prompt.
initPwa();
initInstallPrompt();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
