import { Alert, Spin } from 'antd';
import { usePermissions } from '../../account/hooks/usePermissions';
import { ApiKeySettings } from '../components/ApiKeySettings';
import './apiKeysPage.css';

export default function ApiKeysPage() {
  const access = usePermissions();
  return (
    <main className="api-keys-page">
      <header className="topbar">
        <span>系统配置</span>
        <span>/</span>
        <strong>API 密钥与 MCP</strong>
      </header>
      <div className="api-keys-content">
        <>
          {access.isPending ? (
            <Spin />
          ) : access.can('api-keys.view') ? (
            <ApiKeySettings permissions={access.permissions} />
          ) : (
            <Alert type="warning" title="没有管理API密钥的权限" />
          )}
        </>
      </div>
    </main>
  );
}
