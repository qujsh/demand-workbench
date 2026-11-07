import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Spin } from 'antd';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../../shared/api/httpClient';
import { getCurrentUser, currentUserKey, logout } from '../api/authApi';
import { AuthContext } from '../authContext';
import { AuthPage } from '../pages/AuthPage';

const publicPaths = ['/login', '/login/sms', '/password/forgot', '/password/set'];

export function AuthGate({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const userQuery = useQuery({ queryKey: currentUserKey, queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: true });
  const unauthorized = userQuery.error instanceof ApiError && userQuery.error.status === 401;
  const user = unauthorized ? undefined : userQuery.data;
  const passwordPage = location.pathname.startsWith('/password/');

  const clearAccountCache = async () => {
    await queryClient.cancelQueries();
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth'
      || (query.queryKey[1] !== 'current-user' && query.queryKey[1] !== 'login-background') });
  };
  const handleLogout = async () => {
    await logout();
    await clearAccountCache();
    queryClient.setQueryData(currentUserKey, null);
    navigate('/login', { replace: true });
  };
  const authenticated = async () => {
    await clearAccountCache();
    await queryClient.fetchQuery({ queryKey: currentUserKey, queryFn: getCurrentUser, staleTime: 0 });
  };
  const passwordSaved = async () => {
    await clearAccountCache();
    queryClient.setQueryData(currentUserKey, null);
  };

  if (userQuery.isPending) return <div className="auth-loading"><Spin /></div>;
  if (userQuery.isError && !unauthorized && !user) return <div className="auth-loading">
    <Alert type="error" title="暂时无法连接服务" description="请检查网络后重试。" showIcon
      action={<Button onClick={() => void userQuery.refetch()}>重试</Button>} />
  </div>;
  if (passwordPage || !user) return <AuthPage initialPhone={user?.phone ?? undefined}
    onAuthenticated={authenticated} onPasswordSaved={passwordSaved} />;
  if (publicPaths.includes(location.pathname)) return <Navigate to="/requirements" replace />;
  return <AuthContext.Provider value={{ user, logout: handleLogout }}>{children}</AuthContext.Provider>;
}
