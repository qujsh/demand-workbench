import { ApiKeySettings } from '../components/ApiKeySettings';
import './apiKeysPage.css';

export default function ApiKeysPage() {
  return <main className="api-keys-page">
    <header className="topbar"><span>系统配置</span><span>/</span><strong>API 密钥与 MCP</strong></header>
    <div className="api-keys-content"><ApiKeySettings /></div>
  </main>;
}
