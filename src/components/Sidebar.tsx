import { Avatar } from 'antd';
import { avatarUrl } from '../features/auth';
import { memberNumber } from '../shared/identity/memberPresentation';
import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Icon } from './Icons';
import { useAuth } from '../features/auth/authContext';
import { getNavigation, type NavigationNode } from '../features/account/api/permissionApi';
import { navigationBindings } from '../features/account/navigation';

/** 导航顺序、名称与可见项来自后端，页面路由和图标只由注册代码绑定。 */
export default function Sidebar({ view, onChange }: { view: string; onChange: (target: string) => void }) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const { user, logout } = useAuth();
  const navigation = useQuery({ queryKey: ['account', 'navigation'], queryFn: ({ signal }) => getNavigation(signal), refetchOnWindowFocus: true });
  const render = (nodes: NavigationNode[], depth = 0): React.ReactNode => nodes.map((node) => {
    const itemStyle = { '--sidebar-depth': depth } as CSSProperties;
    if (node.nodeType === 'group') {
      const open = !collapsed.includes(node.code);
      return <div key={node.code} className="sidebar-config"><button className="sidebar-menu-item" style={itemStyle} aria-label={node.name} aria-expanded={open} onClick={() => setCollapsed((current) => open ? [...current, node.code] : current.filter((code) => code !== node.code))}><Icon name="Settings" /><span>{node.name}</span><Icon className="config-chevron" name={open ? 'ChevronDown' : 'ChevronRight'} size={14} /></button>{open && render(node.children, depth + 1)}</div>;
    }
    const binding = navigationBindings[node.code];
    return <button key={node.code} className={`sidebar-menu-item${view === binding?.target ? ' active' : ''}`} style={itemStyle} aria-label={node.name} onClick={() => onChange(binding?.target ?? 'unbound')}><Icon name={binding?.icon ?? 'FileText'} /><span>{node.name}</span></button>;
  });
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><Icon name="Sparkles" size={15} /></span><strong>构想台</strong></div>
    <nav>{navigation.isError ? <button onClick={() => void navigation.refetch()}><Icon name="RefreshCw" /><span>导航加载失败，重试</span></button> : navigation.isPending ? <div className="nav-label">正在加载导航…</div> : render(navigation.data)}</nav>
    <div className="sidebar-bottom"><button onClick={() => void logout()}><Icon name="LogOut" /><span>退出登录</span></button><Link to="/system/settings" className="profile" aria-label="查看个人信息" style={{ textDecoration: 'none' }}><Avatar size={32} src={avatarUrl(user.avatarMediaNo)}>{(user.nickname || '成员').slice(0, 1).toUpperCase()}</Avatar><div><strong>{user.nickname || memberNumber(user)}</strong><small>{user.publisherLevelName || '初访者'}</small></div><Icon name="ChevronsUpDown" size={14} /></Link></div>
  </aside>;
}
