import { Alert, Button, Space, Spin, Table, Tag, Tabs } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PlatformRole, RoleInput } from '../api/roleApi';
import { useRoleConfiguration } from '../hooks/useRoleConfiguration';
import { RoleEditor } from './RoleEditor';
import { PermissionTree } from './PermissionTree';

export function RoleManagement() {
  const { configuration, save } = useRoleConfiguration();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get('tab') === 'common' ? 'common' : 'roles';
  const editorPath = /^\/system\/roles\/([^/]+)\/edit\/?$/.exec(location.pathname);
  const creating = location.pathname === '/system/roles/new';
  if (configuration.isPending) return <Spin />;
  if (configuration.isError) return <Alert type="error" title={configuration.error.message} action={<Button onClick={() => void configuration.refetch()}>重试</Button>} />;
  const { roles, permissions: catalog } = configuration.data;
  const common = roles.find((role) => role.common);
  const edit = (role: PlatformRole | null) => { save.reset(); navigate(role ? `/system/roles/${encodeURIComponent(role.code)}/edit` : '/system/roles/new'); };
  const returnPath = `/system/roles${editorPath && roles.find((role) => encodeURIComponent(role.code) === editorPath[1])?.common ? '?tab=common' : ''}`;
  const persist = async (input: RoleInput) => { await save.mutateAsync(input); navigate(returnPath, { state: { roleSaved: true } }); };
  if (creating || editorPath) {
    const editing = creating ? null : roles.find((role) => encodeURIComponent(role.code) === editorPath?.[1]);
    if (editing === undefined) return <Alert type="warning" title="角色不存在或已被删除" action={<Button onClick={() => navigate('/system/roles')}>返回列表</Button>} />;
    return <RoleEditor key={editing?.code ?? 'new'} role={editing} catalog={catalog} common={common?.permissions ?? []} pending={save.isPending} error={save.isError ? save.error.message : undefined} onSave={persist} onCancel={() => navigate(returnPath)} />;
  }
  if (location.pathname !== '/system/roles' && location.pathname !== '/system/roles/') return <Alert type="warning" title="角色配置页面不存在" action={<Button onClick={() => navigate('/system/roles')}>返回列表</Button>} />;
  return <>
    {location.state?.roleSaved && <Alert type="success" showIcon title="配置已保存，账号权限已更新并写入审计记录" />}
    <Tabs activeKey={tab} onChange={(key) => navigate(key === 'common' ? '/system/roles?tab=common' : '/system/roles', { replace: true })} items={[
      { key: 'roles', label: '角色列表', children: <>
        <div className="system-toolbar"><p className="system-muted">每个账号可分配多个平台角色，权限合并并自动继承公共权限。</p><Button type="primary" onClick={() => edit(null)}>新建角色</Button></div>
        <Table rowKey="code" dataSource={roles.filter((role) => !role.common)} scroll={{ x: 1020 }} pagination={{ pageSize: 10 }} columns={[
          { title: '角色名称', dataIndex: 'name', width: 200, render: (name: string, role: PlatformRole) => <Space>{name}{role.builtIn && <Tag>内置</Tag>}</Space> },
          { title: '说明', dataIndex: 'description', width: 200, render: (value: string) => value || '暂无说明' },
          { title: '状态', width: 90, render: (_, role) => <Tag color={role.enabled ? 'green' : undefined}>{role.enabled ? '已启用' : '已停用'}</Tag> },
          { title: '额外权限', width: 420, render: (_, role) => <Space size={[0, 4]} wrap>{role.permissions.length ? catalog.filter((p) => role.permissions.includes(p.code)).map((p) => <Tag key={p.code}>{p.name}</Tag>) : '仅继承公共权限'}</Space> },
          { title: '操作', width: 110, render: (_, role) => <Button type="link" onClick={() => edit(role)}>{role.code === 'admin' ? '查看权限' : '编辑'}</Button> },
        ]} />
      </> },
      { key: 'common', label: '公共权限', children: <>
        <Alert type="info" showIcon title="所有正常账号自动继承；角色权限与公共权限叠加。本人资料、密码、安全设置和退出登录始终可用。" />
        <div className="system-toolbar"><span className="system-muted">查看公共权限的层级与授权情况</span><Button disabled={!common} onClick={() => { if (common) edit(common); }}>编辑公共权限</Button></div>
        <PermissionTree catalog={catalog.filter((permission) => permission.publicAllowed)} selected={common?.permissions ?? []} disabled onToggle={() => undefined} />
      </> },
    ]} />

  </>;
}
