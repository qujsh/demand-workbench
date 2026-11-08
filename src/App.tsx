import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { Icon } from './components/Icons';
import { usePermissions } from './features/account/hooks/usePermissions';
import { Alert, Button, Spin } from 'antd';
const SystemConfiguration = lazy(() => import('./features/account/pages/SystemConfiguration'));
const CategoryManagement = lazy(() => import('./features/categories/pages/CategoryManagement'));
const SharePage = lazy(() => import('./features/shares/SharePage'));
const CallAuditsPage = lazy(() => import('./features/open-platform/pages/CallAuditsPage'));
const ApiKeysPage = lazy(() => import('./features/open-platform/pages/ApiKeysPage'));
const SettingsPage = lazy(() => import('./features/auth/pages/SettingsPage'));
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const access = usePermissions();
  const [toast, setToast] = useState('');
  const path = location.pathname;
  const settings = path === '/system/settings';
  const system = path.startsWith('/system/');
  const categories = path === '/configuration/categories';
  const shares = path === '/shares';
  const allowed = shares
    ? access.can('shares.use')
    : categories
      ? access.can('categories.read')
      : true;
  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      setToast(message);
      window.setTimeout(() => setToast(''), 2400);
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  return (
    <div className="app flex min-h-screen">
      {!settings && (
        <Link to="/system/settings" className="settings-mobile-entry">
          个人设置
        </Link>
      )}
      <Sidebar
        view={
          system
            ? `system/${path.split('/')[2]}`
            : categories
              ? 'categories'
              : shares
                ? 'shares'
                : ''
        }
        onChange={(target) =>
          navigate(target === 'categories' ? '/configuration/categories' : `/${target}`)
        }
      />
      <div className="app-content min-w-0 flex-1">
        <Suspense fallback={<Spin />}>
          {access.isPending ? (
            <Spin />
          ) : access.isError ? (
            <Alert
              type="error"
              title="无法加载权限"
              action={<Button onClick={() => void access.refetch()}>重试</Button>}
            />
          ) : !allowed ? (
            <Alert type="warning" title="暂无访问权限" />
          ) : (
            <>
              {settings ? (
                <SettingsPage />
              ) : system ? (
                path === '/system/call-audits' ? (
                  <CallAuditsPage />
                ) : path === '/system/api-keys' ? (
                  <ApiKeysPage />
                ) : (
                  <SystemConfiguration page={path.split('/')[2] ?? ''} />
                )
              ) : categories ? (
                <CategoryManagement />
              ) : shares ? (
                <SharePage />
              ) : (
                <Alert
                  type="info"
                  title="页面不存在或已下线"
                  action={<Link to="/shares">前往分享管理</Link>}
                />
              )}
            </>
          )}
        </Suspense>
      </div>
      {toast && (
        <div className="toast">
          <Icon name="CircleCheck" />
          {toast}
        </div>
      )}
    </div>
  );
}
