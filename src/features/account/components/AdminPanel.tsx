import { Alert, Button, Collapse, Form, Input, InputNumber, Popconfirm, Select, Switch, Table, Tabs } from 'antd';
import { useState } from 'react';
import type { Adjustment, LevelRule } from '../api/accountApi';
import { useAdmin } from '../hooks/useAccountPlatform';
import { kindNames, roleNames, timeText } from '../accountPresentation';

function RuleEditor({ rule, save, pending }: { rule: LevelRule; save: (rule: LevelRule) => void; pending: boolean }) {
  const [points, setPoints] = useState(rule.minPoints);
  const [enabled, setEnabled] = useState(rule.enabled);
  return <div className="account-inline-controls">
    <InputNumber aria-label={`${rule.levelCode}成长门槛`} min={1} max={1_000_000_000_000} value={points} placeholder="未配置" onChange={setPoints} />
    <Switch aria-label={`${rule.levelCode}启用规则`} checked={enabled} onChange={setEnabled} />
    <Button loading={pending} disabled={enabled && points === null} onClick={() => save({ ...rule, minPoints: points, enabled })}>保存规则</Button>
  </div>;
}

function AdjustmentForm({ save, pending }: { save: (input: Adjustment) => Promise<unknown>; pending: boolean }) {
  const [eventNo, setEventNo] = useState(() => crypto.randomUUID());
  const [form] = Form.useForm();
  return <Form form={form} layout="vertical" initialValues={{ kind: 'publisher', metric: 'growth' }} onFinish={async (values: Omit<Adjustment, 'eventNo'>) => {
    try { await save({ ...values, eventNo }); setEventNo(crypto.randomUUID()); form.resetFields(); } catch { /* 错误由统一操作提示展示，保留事件编号以便安全重试。 */ }
  }}>
    <Form.Item name="userNo" label="账号编号" rules={[{ required: true, whitespace: true }]}><Input placeholder="USER-000001" /></Form.Item>
    <Form.Item name="kind" label="业务身份"><Select options={Object.entries(kindNames).map(([value, label]) => ({ value, label }))} /></Form.Item>
    <Form.Item name="metric" label="记录类型"><Select options={[{ value: 'growth', label: '成长值' }, { value: 'credit', label: '信用变化' }]} /></Form.Item>
    <Form.Item name="delta" label="变化值" rules={[{ required: true }, { validator: (_, value: number) => value === 0 ? Promise.reject(new Error('变化值不能为零')) : Promise.resolve() }]}><InputNumber min={-1_000_000} max={1_000_000} precision={0} /></Form.Item>
    <Form.Item name="reason" label="调整原因" rules={[{ required: true, whitespace: true }]}><Input.TextArea maxLength={300} rows={2} /></Form.Item>
    <Button htmlType="submit" type="primary" loading={pending}>记录人工调整</Button>
  </Form>;
}

export default function AdminPanel({ permissions, rules }: { permissions: string[]; rules: LevelRule[] }) {
  const { users, audits, save } = useAdmin(permissions);
  const [selectedUser, setSelectedUser] = useState('');
  const [role, setRole] = useState('member');
  const [status, setStatus] = useState('active');
  const accounts = permissions.includes('accounts.manage');
  const growth = permissions.includes('growth.manage');
  return <section className="settings-section">
    <h2>平台管理</h2>
    {save.isError && <Alert type="error" title={save.error.message} showIcon />}
    {save.isSuccess && <Alert type="success" title="操作已保存并写入审计记录" showIcon />}
    <Collapse items={[{ key: 'admin', label: '打开管理控制台', children: <Tabs items={[
      ...(accounts ? [{ key: 'users', label: '账号与角色', children: <>
        {users.isError && <Alert type="error" title={users.error.message} />}
        <Table rowKey="userNo" size="small" dataSource={users.data} loading={users.isPending} scroll={{ x: 520 }} pagination={{ pageSize: 5 }} columns={[
          { title: '账号', dataIndex: 'userNo' }, { title: '昵称', dataIndex: 'nickname' },
          { title: '角色', dataIndex: 'role', render: (value: string) => roleNames[value] || value },
          { title: '状态', dataIndex: 'status', render: (value: string) => ({ active: '正常', restricted: '受限', suspended: '暂停', banned: '禁用' })[value] || value },
          { title: '操作', render: (_: unknown, user: { userNo: string; role: string; status: string }) => <Button onClick={() => { setSelectedUser(user.userNo); setRole(user.role); setStatus(user.status); }}>管理</Button> },
        ]} />
        {selectedUser && <div className="account-admin-editor"><strong>管理 {selectedUser}</strong>
          {permissions.includes('roles.manage') && <div className="account-inline-controls"><Select aria-label="平台角色" value={role} onChange={setRole} options={['member', 'operator', 'admin'].map((value) => ({ value, label: roleNames[value] }))} />
            <Popconfirm title="确认变更平台角色？" onConfirm={() => save.mutateAsync({ action: 'role', userNo: selectedUser, role }).catch(() => undefined)}><Button loading={save.isPending}>保存角色</Button></Popconfirm></div>}
          <div className="account-inline-controls"><Select aria-label="账号状态" value={status} onChange={setStatus} options={[{ value: 'active', label: '正常' }, { value: 'restricted', label: '受限' }, { value: 'suspended', label: '暂停' }, { value: 'banned', label: '禁用' }]} />
            <Popconfirm title="确认变更账号状态？" description="停用会使该账号全部登录失效。" onConfirm={() => save.mutateAsync({ action: 'status', userNo: selectedUser, status }).catch(() => undefined)}><Button loading={save.isPending}>保存状态</Button></Popconfirm></div>
        </div>}
      </> }] : []),
      ...(growth ? [{ key: 'rules', label: '成长规则', children: <>
        <p className="settings-subtitle">未启用的规则不触发升级。门槛随等级递增，新规则在后续成长记账时生效，已获得等级不会自动降低。</p>
        <Table rowKey={(rule: LevelRule) => `${rule.kind}-${rule.levelCode}`} size="small" scroll={{ x: 630 }} dataSource={rules.filter((rule) => rule.sortOrder > 1)} pagination={{ pageSize: 5 }} columns={[
          { title: '身份', dataIndex: 'kind', render: (kind: keyof typeof kindNames) => kindNames[kind] }, { title: '等级', render: (_: unknown, rule: LevelRule) => `${rule.levelCode} ${rule.levelName}` },
          { title: '门槛与启用状态', render: (_: unknown, rule: LevelRule) => <RuleEditor key={`${rule.kind}-${rule.levelCode}-${rule.version}`} rule={rule} pending={save.isPending} save={(updated) => save.mutate({ action: 'rule', rule: updated })} /> },
        ]} />
      </> }, { key: 'adjust', label: '人工调整', children: <AdjustmentForm pending={save.isPending} save={(adjustment) => save.mutateAsync({ action: 'adjust', adjustment })} /> }] : []),
      ...(permissions.includes('audit.read') ? [{ key: 'audit', label: '操作审计', children: <>
        {audits.isError && <Alert type="error" title={audits.error.message} />}
        <Table rowKey="id" size="small" loading={audits.isPending} dataSource={audits.data} scroll={{ x: 680 }} pagination={{ pageSize: 5 }} columns={[
          { title: '时间', dataIndex: 'createdAt', render: timeText }, { title: '操作人', dataIndex: 'operatorNo' }, { title: '目标', dataIndex: 'targetNo' }, { title: '内容', dataIndex: 'detail' },
        ]} />
      </> }] : []),
    ]} /> }]} />
  </section>;
}
