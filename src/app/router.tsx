import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import { AuthGate } from '../features/auth/components/AuthGate';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/notes" replace /> },
  { path: '/shares', element: <Navigate to="/notes" replace /> },
  { path: '/settings', element: <Navigate to="/system/settings" replace /> },
  {
    path: '*',
    element: (
      <AuthGate>
        <App />
      </AuthGate>
    ),
  },
]);
