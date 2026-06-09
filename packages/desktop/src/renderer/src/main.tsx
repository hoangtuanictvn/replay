import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DialogsProvider } from './components/Dialogs';
import { ToastProvider } from './components/Toast';
import './styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing');
createRoot(el).render(
  <React.StrictMode>
    <ToastProvider>
      <DialogsProvider>
        <App />
      </DialogsProvider>
    </ToastProvider>
  </React.StrictMode>,
);
