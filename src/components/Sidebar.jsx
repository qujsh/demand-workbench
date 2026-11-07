import { useState } from 'react';
import { Icon } from './Icons';
import { useAuth } from '../features/auth/authContext';
import { usePermissions } from '../features/account/hooks/usePermissions';
import { Link } from 'react-router-dom';

const items = [
  ['LayoutDashboard', '工作台', 'dashboard'],
  ['Inbox', '需求管理', 'requirements'],
  ['Pencil', '分享管理', 'shares'],
  ['Users', '承接管理', 'talent'],
  ['ClipboardCheck', '交付验收', 'delivery'],
];

export default function Sidebar({ view, onChange }) {
  const [configOpen, setConfigOpen] = useState(true);
  const [systemOpen, setSystemOpen] = useState(true);
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const systemItems = [
    ['个人设置', 'settings', null, 'UserRound'],
    ['API 密钥与 MCP', 'api-keys', null, 'ShieldCheck'],
    ['账号管理', 'accounts', 'accounts.manage', 'Users'],
    ['角色管理', 'roles', 'roles.manage', 'ShieldCheck'],
    ['权限管理', 'permissions', 'permissions.manage', 'KeyRound'],
    ['成长与信用', 'growth', 'growth.manage', 'TrendingUp'],
    ['操作审计', 'audits', 'audit.read', 'History'],
  ].filter(([, , permission]) => !permission || can(permission));
  const initial = user.nickname.slice(0, 1).toUpperCase();
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><Icon name="Sparkles" size={15}/></span><strong>构想台</strong></div>
    <nav>
      <div className="nav-label">工作空间</div>
      {items.filter(([, , key]) => key === 'requirements' ? can('requirements.use') : key === 'shares' ? can('shares.use') : true).map(([icon,label,key]) => <button key={key} className={view===key?'active':''} onClick={()=>onChange(key)}>
        <Icon name={icon}/><span>{label}</span>{key==='requirements'&&<em>4</em>}
      </button>)}
      {can('categories.read') && <div className="sidebar-config">
        <button aria-expanded={configOpen} onClick={() => setConfigOpen(!configOpen)}>
          <Icon name="Settings"/><span>配置中心</span><Icon className="config-chevron" name={configOpen ? 'ChevronDown' : 'ChevronRight'} size={14}/>
        </button>
        {configOpen && <button className={`sidebar-subitem ${view === 'categories' ? 'active' : ''}`} onClick={() => onChange('categories')}>
          <Icon name="ListFilter" size={16}/><span>分类管理</span>
        </button>}
      </div>}
      {systemItems.length > 0 && <div className="sidebar-config">
        <button aria-expanded={systemOpen} onClick={() => setSystemOpen(!systemOpen)}>
          <Icon name="Settings"/><span>系统配置</span><Icon className="config-chevron" name={systemOpen ? 'ChevronDown' : 'ChevronRight'} size={14}/>
        </button>
        {systemOpen && systemItems.map(([label, key, , icon]) => <button key={key} className={`sidebar-subitem ${view === `system/${key}` ? 'active' : ''}`} onClick={() => onChange(`system/${key}`)}><Icon name={icon} size={16}/><span>{label}</span></button>)}
      </div>}
    </nav>
    <div className="sidebar-bottom">
      <button onClick={() => void logout()}><Icon name="LogOut"/><span>退出登录</span></button>
      <Link to="/system/settings" className="profile" aria-label="查看个人信息" style={{ textDecoration: 'none' }}><span>{initial}</span><div><strong>{user.nickname}</strong><small>{user.publisherLevelName || '初访者'}</small></div><Icon name="ChevronsUpDown" size={14}/></Link>
    </div>
  </aside>
}
