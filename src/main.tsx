import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './lib/auth';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          containerStyle={{ top: 80 }}
          toastOptions={{
            duration: 4500,
            style: { fontSize: '0.9rem', borderRadius: '0.75rem' },
            success: { ariaProps: { role: 'status', 'aria-live': 'polite' } },
            error: { ariaProps: { role: 'alert', 'aria-live': 'assertive' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
