import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/requirements" replace /> },
  { path: '*', element: <App /> },
]);
