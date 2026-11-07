import { Alert, Button, Form, Input, Modal, Space, Switch, Tag } from 'antd';
import { useState } from 'react';
import type { PermissionDefinition, PlatformRole, RoleInput } from '../api/roleApi';
import { PermissionTree } from './PermissionTree';

type Props = { role: PlatformRole | null; catalog: PermissionDefinition[]; common: string[]; pending: boolean; error?: string; onSave: (input: RoleInput) => Promise<void>; onCancel: () => void };
export function RoleEditor({ role, catalog, common, pending, error, onSave, onCancel }: Props) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [enabled, setEnabled] = useState(role?.enabled ?? true);
  const [selected, setSelected] = useState(role?.permissions ?? []);
  const [confirm, setConfirm] = useState(false);
  const protectedRole = role?.code === 'admin';
  const available = catalog.filter((p) => !role?.common || p.publicAllowed);
  const submit = async () => {
    await onSave({ code: role?.code ?? null, name: name.trim(), description: description.trim(), enabled, version: role?.version ?? 0, permissions: selected });
  };
  const toggle = (codes: string[], checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    for (const code of codes) {
      if (checked) next.add(code);
      else next.delete(code);
    }
    if (!checked && codes.includes('categories.read')) {
      for (const code of next) if (code.startsWith('categories.')) next.delete(code);
    } else if (checked && codes.some((code) => code.startsWith('categories.'))) next.add('categories.read');
    return [...next];
  });
  const title = protectedRole ? '查看角色权限' : role?.common ? '编辑公共权限' : role ? '编辑角色' : '新建角色';
  return <section className="system-role-editor">
    <div className="system-role-heading"><h1>{title}</h1><Space>
      <Button disabled={pending} onClick={onCancel}>返回列表</Button>
      {!protectedRole && <Button type="primary" loading={pending} disabled={!name.trim()} onClick={() => { if (role?.common) setConfirm(true); else void submit().catch(() => undefined); }}>保存配置</Button>}
    </Space></div>
    <Form layout="vertical" className="system-role-form">
      {protectedRole && <Alert type="info" showIcon title="内置平台管理员受保护，权限不可修改，角色不可停用。" />}
      {role?.common ? <Alert type="info" showIcon title="公共权限由所有正常账号自动继承，角色未勾选不会撤销公共权限。账号安全设置和退出登录始终保留。" /> : <>
        {protectedRole ? <div className="system-role-summary">
          <div><span className="system-muted">角色名称</span><div>{name}</div></div>
          <div><span className="system-muted">角色状态</span><div><Tag color="green">已启用</Tag></div></div>
          <div className="system-role-description"><span className="system-muted">角色说明</span><div>{description || '暂无说明'}</div></div>
        </div> : <>
        <div className="system-role-fields">
        <Form.Item label="角色名称" required><Input aria-label="角色名称" value={name} maxLength={40} disabled={protectedRole} onChange={(event) => setName(event.target.value)} /></Form.Item>
        <Form.Item label="启用角色"><Switch aria-label="启用角色" checked={enabled} disabled={protectedRole || role?.code === 'member'} onChange={setEnabled} /></Form.Item>
        </div>
        <p className="system-muted">仍有关联账号的角色需先调整账号角色，才能停用。</p>
        <Form.Item label="角色说明"><Input.TextArea aria-label="角色说明" value={description} rows={2} maxLength={300} onChange={(event) => setDescription(event.target.value)} /></Form.Item>
        </>}
        {common.length > 0 && <div className="system-inherited"><span>自动继承公共权限：</span>{catalog.filter((p) => common.includes(p.code)).map((p) => <Tag key={p.code}>{p.name}</Tag>)}</div>}
      </>}
      <PermissionTree catalog={available} selected={selected} disabled={protectedRole} onToggle={toggle} />
      {error && <Alert type="error" showIcon title={error} />}
    </Form>
    <Modal title="确认修改公共权限？" open={confirm} okText="确认影响所有账号" cancelText="返回编辑" confirmLoading={pending} onCancel={() => { if (!pending) setConfirm(false); }} onOk={() => void submit().then(() => setConfirm(false)).catch(() => setConfirm(false))}>
      <Space orientation="vertical"><p>本次修改会影响所有正常账号的业务功能访问权限，保存后写入审计记录。</p><p>平台管理员自身的受保护权限不受影响。</p></Space>
    </Modal>
  </section>;
}
