import { Alert, Button, Spin } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '../hooks/usePermissions';
import { accountKeys, getRules } from '../api/accountApi';
import AdminPanel from '../components/AdminPanel';
import { RoleManagement } from '../components/RoleManagement';
import { PermissionManagement } from '../components/PermissionManagement';
import '../system.css';

const sections = {
  accounts: { name: '账号管理', permission: 'accounts.manage', section: 'users' },
  roles: { name: '角色管理', permission: 'roles.manage', section: 'users' },
  permissions: { name: '权限管理', permission: 'permissions.manage', section: 'users' },
  growth: { name: '成长与信用', permission: 'growth.manage', section: 'rules' },
  audits: { name: '操作审计', permission: 'audit.read', section: 'audit' },
} as const;
export default function SystemConfiguration({ page }: { page: string }) {
  const access = usePermissions();
  const location = useLocation();
  const roleEditor = page === 'roles' && location.pathname.replace(/\/$/, '') !== '/system/roles';
  const editorTitle = location.pathname === '/system/roles/new' ? '新建角色' : location.pathname === '/system/roles/admin/edit' ? '查看角色权限' : location.pathname === '/system/roles/public/edit' ? '编辑公共权限' : '编辑角色';
  const target = sections[page as keyof typeof sections];
  const rules = useQuery({ queryKey: accountKeys.rules, queryFn: ({ signal }) => getRules(signal), enabled: page === 'growth' && access.can('growth.manage') });
  if (!target) return <Alert type="error" title="系统配置页面不存在" />;
  return <main className="system-page">
    <header className="topbar"><span>系统配置</span><span>/</span>{roleEditor ? <><Link to="/system/roles">角色管理</Link><span>/</span><strong>{editorTitle}</strong></> : <strong>{target.name}</strong>}</header>
    <div className="system-content">{!roleEditor && <><h1>{target.name}</h1><p className="system-muted">管理平台账号、角色与权限，所有管理变更均记录操作审计。</p></>}
      {access.isPending ? <Spin /> : !access.can(target.permission) ? <Alert type="warning" showIcon title={access.isError ? '权限加载失败，请刷新重试' : '暂无访问权限'} action={<Link to="/system/settings"><Button>个人设置</Button></Link>} /> : page === 'roles' ? <RoleManagement /> : page === 'permissions' ? <PermissionManagement /> : <AdminPanel permissions={access.permissions} rules={rules.data ?? []} section={target.section} />}
    </div>
  </main>;
}
