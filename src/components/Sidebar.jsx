import { useState } from 'react';
import { Icon } from './Icons';
import { useAuth } from '../features/auth/authContext';
import { Link } from 'react-router-dom';

const items = [
  ['LayoutDashboard', '工作台', 'dashboard'],
  ['Inbox', '需求管理', 'requirements'],
  ['Users', '承接管理', 'talent'],
  ['ClipboardCheck', '交付验收', 'delivery'],
];

export default function Sidebar({ view, onChange }) {
  const [configOpen, setConfigOpen] = useState(true);
  const { user, logout } = useAuth();
  const initial = user.nickname.slice(0, 1).toUpperCase();
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><Icon name="Sparkles" size={15}/></span><strong>构想台</strong></div>
    <nav>
      <div className="nav-label">工作空间</div>
      {items.map(([icon,label,key]) => <button key={key} className={view===key?'active':''} onClick={()=>onChange(key)}>
        <Icon name={icon}/><span>{label}</span>{key==='requirements'&&<em>4</em>}
      </button>)}
      <div className="sidebar-config">
        <button aria-expanded={configOpen} onClick={() => setConfigOpen(!configOpen)}>
          <Icon name="Settings"/><span>配置中心</span><Icon className="config-chevron" name={configOpen ? 'ChevronDown' : 'ChevronRight'} size={14}/>
        </button>
        {configOpen && <button className={`sidebar-subitem ${view === 'categories' ? 'active' : ''}`} onClick={() => onChange('categories')}>
          <Icon name="ListFilter" size={16}/><span>分类管理</span>
        </button>}
      </div>
    </nav>
    <div className="sidebar-bottom">
      <button className={view === 'settings' ? 'active' : ''} onClick={() => onChange('settings')}><Icon name="Settings"/><span>个人设置</span></button>
      <button onClick={() => void logout()}><Icon name="LogOut"/><span>退出登录</span></button>
      <Link to="/settings" className="profile" aria-label="查看个人信息" style={{ textDecoration: 'none' }}><span>{initial}</span><div><strong>{user.nickname}</strong><small>{user.publisherLevelName || '初访者'}</small></div><Icon name="ChevronsUpDown" size={14}/></Link>
    </div>
  </aside>
}
