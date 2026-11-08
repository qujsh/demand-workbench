import { Alert, App, Button, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { accountKeys, getAdminUserPage, saveAdmin } from '../api/accountApi';
import type { AccountFilters, AdminUser } from '../api/accountApi';
import { getRoleOptions, roleKeys } from '../api/roleApi';
import { memberNumber } from '../../../shared/identity/memberPresentation';
import { roleNames, timeText } from '../accountPresentation';

type AccountDraft = { roles: string[]; status: 'active' | 'banned' };
const statusNames: Record<string, string> = { active: '正常', banned: '禁用', closing: '注销中', closed: '已注销' };
const dateText = (value?: string | null) => value ? timeText(value) : '暂无记录';

function AccountDrawer({ user, permissions, options, rolesLoading, rolesError, onClose }: {
  user: AdminUser; permissions: string[]; options: { code: string; name: string; enabled: boolean }[];
  rolesLoading: boolean; rolesError?: string; onClose: () => void;
}) {
  const [form] = Form.useForm<AccountDraft>();
  const client = useQueryClient();
  const { modal, message } = App.useApp();
  const canEditRoles = permissions.includes('roles.manage');
  const editable = ['active', 'banned'].includes(user.status);
  const draftRoles = Form.useWatch('roles', form) ?? user.roles;
  const draftStatus = Form.useWatch('status', form) ?? user.status;
  const changed = draftStatus !== user.status || [...draftRoles].sort().join(',') !== [...user.roles].sort().join(',');
  const save = useMutation({ mutationFn: saveAdmin, onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: accountKeys.users }), client.invalidateQueries({ queryKey: accountKeys.audits }), client.invalidateQueries({ queryKey: accountKeys.overview }), client.invalidateQueries({ queryKey: ['auth', 'current-user'] }), client.invalidateQueries({ queryKey: ['auth', 'publisher-eligibility'] })]);
    void message.success('账号配置已保存并写入审计记录');
    onClose();
  } });
  const close = () => {
    if (save.isPending) return;
    if (changed) modal.confirm({ title: '放弃未保存的修改？', okText: '放弃修改', cancelText: '继续编辑', onOk: onClose });
    else onClose();
  };
  const submit = (values: AccountDraft) => {
    const commit = () => save.mutateAsync({ action: 'account', userNo: user.userNo, ...values });
    if (values.status === 'banned' && user.status !== 'banned') {
      modal.confirm({ title: '确认禁用该账号？', content: '该账号的全部登录会话将失效，恢复正常后需要重新登录。', okText: '确认禁用', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => commit().catch(() => undefined) });
    } else void commit().catch(() => undefined);
  };
  return <Drawer title="管理账号" open size="min(560px, 100vw)" onClose={close} maskClosable={!save.isPending} keyboard={!save.isPending}
    footer={<div className="account-drawer-footer"><Button disabled={save.isPending} onClick={close}>取消</Button><Button type="primary" loading={save.isPending} disabled={!editable || !changed || (canEditRoles && (rolesLoading || !!rolesError))} onClick={() => form.submit()}>保存修改</Button></div>}>
    <Descriptions column={1} size="small" items={[
      { key: 'no', label: '成员编号', children: memberNumber(user) }, { key: 'name', label: '昵称', children: user.nickname || memberNumber(user) },
      { key: 'created', label: '注册时间', children: dateText(user.createdAt) }, { key: 'login', label: '最近登录', children: dateText(user.lastLoginAt) },
    ]} />
    {!editable && <Alert type="info" showIcon title="该账号正在注销或已注销，无法修改角色与状态。" />}
    <Form form={form} layout="vertical" className="account-management-form" initialValues={{ roles: user.roles, status: user.status }} onFinish={submit} disabled={!editable || save.isPending}>
      <Form.Item name="roles" label="平台角色" rules={[{ required: true, type: 'array', min: 1, message: '请至少选择一个角色' }]} extra={canEditRoles ? '可分配多个角色，权限取所有已启用角色与公共权限的并集。' : '当前账号没有修改角色的权限。'}>
        <Select mode="multiple" aria-label="平台角色" placeholder="请选择一个或多个角色" loading={rolesLoading} disabled={!canEditRoles || !editable || save.isPending || !!rolesError} optionFilterProp="label"
          options={options.filter((role) => role.enabled || user.roles.includes(role.code)).map((role) => ({ value: role.code, label: `${role.name}${role.enabled ? '' : '（已停用）'}`, disabled: !role.enabled }))} />
      </Form.Item>
      {rolesError && <Alert type="error" showIcon title={rolesError} />}
      <Form.Item name="status" label="账号状态" extra="禁用后全部登录失效；不能禁用自己，也不能移除最后一位正常管理员。">
        <Select aria-label="账号状态" options={editable ? [{ value: 'active', label: '正常' }, { value: 'banned', label: '禁用' }] : [{ value: user.status, label: statusNames[user.status] || user.status }]} />
      </Form.Item>
      {save.isError && <Alert type="error" showIcon title={save.error.message} />}
    </Form>
  </Drawer>;
}

export default function AccountManagement({ permissions }: { permissions: string[] }) {
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<AccountFilters>({ keyword: '', page: 1, pageSize: 10 });
  const [selected, setSelected] = useState<AdminUser>();
  const users = useQuery({ queryKey: [...accountKeys.users, filters], queryFn: ({ signal }) => getAdminUserPage(filters, signal), placeholderData: keepPreviousData, enabled: permissions.includes('accounts.manage') });
  const roleOptions = useQuery({ queryKey: roleKeys.options, queryFn: ({ signal }) => getRoleOptions(signal) });
  const options = roleOptions.data ?? [];
  const names = Object.fromEntries(options.map((role) => [role.code, role.name]));
  const changeFilters = (patch: Partial<AccountFilters>) => setFilters((current) => ({ ...current, ...patch, page: 1 }));
  return <section className="settings-section">
    <div className="account-search-toolbar">
      <Input.Search aria-label="搜索账号" placeholder="搜索成员编号、昵称" value={keyword} maxLength={80} allowClear onChange={(event) => { setKeyword(event.target.value); if (!event.target.value) changeFilters({ keyword: '' }); }} onSearch={(value) => changeFilters({ keyword: value.trim() })} />
      <Select aria-label="筛选角色" placeholder="全部角色" allowClear showSearch optionFilterProp="label" value={filters.role} loading={roleOptions.isPending} options={options.map((role) => ({ value: role.code, label: role.name }))} onChange={(role: string | undefined) => changeFilters({ role })} />
      <Select aria-label="筛选状态" placeholder="全部状态" allowClear value={filters.status} options={[{ value: 'active', label: '正常' }, { value: 'banned', label: '禁用' }]} onChange={(status: AccountFilters['status']) => changeFilters({ status })} />
      <Button onClick={() => { setKeyword(''); setFilters({ keyword: '', page: 1, pageSize: filters.pageSize }); }}>重置筛选</Button>
    </div>
    {roleOptions.isError && <Alert type="error" showIcon title={roleOptions.error.message} action={<Button size="small" onClick={() => void roleOptions.refetch()}>重试</Button>} />}
    {users.isError && <Alert type="error" showIcon title={users.error.message} action={<Button size="small" onClick={() => void users.refetch()}>重试</Button>} />}
    <Table<AdminUser> rowKey="userNo" size="small" loading={users.isFetching} dataSource={users.data?.items ?? []} scroll={{ x: 1050 }} locale={{ emptyText: '暂无符合条件的账号' }}
      pagination={{ current: filters.page, pageSize: filters.pageSize, total: users.data?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (total) => `共 ${total} 个账号`, onChange: (page, pageSize) => setFilters((current) => ({ ...current, page: pageSize === current.pageSize ? page : 1, pageSize })) }}
      columns={[
        { title: '成员编号', width: 180, render: (_, user) => memberNumber(user) }, { title: '昵称', width: 150, render: (_, user) => user.nickname || memberNumber(user) },
        { title: '角色', dataIndex: 'roles', width: 220, render: (roles: string[]) => <Space size={[0, 4]} wrap>{roles.length ? roles.map((code) => <Tag key={code}>{names[code] || roleNames[code] || code}</Tag>) : '未分配'}</Space> },
        { title: '状态', dataIndex: 'status', width: 80, render: (value: string) => <Tag color={value === 'active' ? 'success' : value === 'banned' ? 'error' : 'default'}>{statusNames[value] || value}</Tag> },
        { title: '注册时间', dataIndex: 'createdAt', width: 155, render: dateText }, { title: '最近登录', dataIndex: 'lastLoginAt', width: 155, render: dateText },
        { title: '操作', width: 90, fixed: 'right', render: (_, user) => <Button size="small" onClick={() => setSelected(user)}>管理</Button> },
      ]} />
    {selected && <AccountDrawer key={selected.userNo} user={selected} permissions={permissions} options={options} rolesLoading={roleOptions.isPending} rolesError={roleOptions.error?.message} onClose={() => setSelected(undefined)} />}
  </section>;
}
