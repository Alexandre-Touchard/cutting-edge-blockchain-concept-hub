import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { ToastHost } from './ui/toast';

// i18n: wait for the visitor's language (a small lazy chunk) so the first paint isn't in English.
import { i18nReady } from './i18n';

function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
        <ToastHost />
      </BrowserRouter>
    </React.StrictMode>
  );
}

// Render even if a language chunk fails to load (English fallback is bundled).
i18nReady.then(render, render);
