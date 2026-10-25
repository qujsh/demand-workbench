import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import './tailwind.css';
import './styles.css';
import './requirements.css';
import './analysis.css';
import './publish.css';
import './features/auth/auth.css';
import './features/auth/pages/settings.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>,
);
