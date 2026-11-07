import { Alert, Button, Input, Space, Spin, Table, Tag, Tooltip } from 'antd';
import { useState } from 'react';
import type { PermissionInput, PermissionNode } from '../api/permissionApi';
import { usePermissionDirectory } from '../hooks/usePermissionDirectory';
import { PermissionNodeEditor } from './PermissionNodeEditor';

type Row = PermissionNode & { children?: Row[] };
type Editing = { node: PermissionNode | null; nodeType: PermissionNode['nodeType']; parentCode: string | null };
export function PermissionManagement() {
  const { directory, save } = usePermissionDirectory();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [editing, setEditing] = useState<Editing>();
  if (directory.isPending) return <Spin />;
  if (directory.isError) return <Alert type="error" title={directory.error.message} action={<Button onClick={() => void directory.refetch()}>重试</Button>} />;
  const catalog = directory.data;
  const keyword = search.trim().toLocaleLowerCase();
  const rows = (parent: string | null, parentMatches = false): Row[] => catalog.filter((node) => node.parentCode === parent).flatMap((node) => {
    const matches = parentMatches || `${node.code} ${node.name} ${node.nameEn} ${node.description} ${node.descriptionEn}`.toLocaleLowerCase().includes(keyword);
    const children = rows(node.code, matches);
    if (keyword && !matches && !children.length) return [];
    return [{ ...node, ...(children.length ? { children } : {}) }];
  });
  const edit = (value: Editing) => { save.reset(); setEditing(value); };
  const persist = async (input: PermissionInput) => { await save.mutateAsync({ input, creating: !editing?.node }); setEditing(undefined); };
  return <>
    <Alert type="info" showIcon title="先维护权限目录，再分配给角色；新增定义后，需由业务代码绑定对应权限编码。模块用于组织层级，不直接授权。" />
    {save.isSuccess && <Alert type="success" showIcon title="权限目录已保存，角色配置目录已同步更新并记录审计" />}
    <div className="system-toolbar"><Input aria-label="搜索权限目录" placeholder="搜索中英文名称、编码或说明" allowClear value={search} onChange={(event) => setSearch(event.target.value)} /><Space><Button type="primary" onClick={() => edit({ node: null, nodeType: 'module', parentCode: null })}>新增模块</Button><Button disabled={!catalog.some((node) => node.nodeType === 'module' && node.enabled)} onClick={() => edit({ node: null, nodeType: 'action', parentCode: null })}>新增权限</Button></Space></div>
    <Table<Row> key={keyword ? 'search' : 'all'} rowKey="code" dataSource={rows(null)} scroll={{ x: 1320 }} pagination={false} expandable={{ expandedRowKeys: catalog.filter((node) => node.nodeType === 'module' && !collapsed.includes(node.code)).map((node) => node.code), onExpand: (expanded, node) => setCollapsed((current) => expanded ? current.filter((code) => code !== node.code) : [...current, node.code]) }} columns={[
      { title: '中文名称', dataIndex: 'name', width: 240, render: (name: string, node) => <Tooltip title={node.description}>{name}</Tooltip> },
      { title: '英文名称', dataIndex: 'nameEn', width: 220, render: (name: string, node) => <Tooltip title={node.descriptionEn}>{name}</Tooltip> },
      { title: '英文编码', dataIndex: 'code', width: 220 },
      { title: '类型', width: 90, render: (_, node) => node.nodeType === 'module' ? '模块' : '操作权限' },
      { title: '状态', width: 90, render: (_, node) => <Tag color={node.enabled ? 'green' : undefined}>{node.enabled ? '已启用' : '已停用'}</Tag> },
      { title: '属性', width: 150, render: (_, node) => <Space size={0} wrap>{node.builtIn && <Tag>内置</Tag>}{node.publicAllowed && <Tag>可设为公共</Tag>}</Space> },
      { title: '排序', dataIndex: 'sortOrder', width: 70 },
      { title: '操作', width: 240, render: (_, node) => <Space size={0} wrap><Button type="link" onClick={() => edit({ node, nodeType: node.nodeType, parentCode: node.parentCode })}>编辑</Button>{node.nodeType === 'module' && <><Button type="link" onClick={() => edit({ node: null, nodeType: 'module', parentCode: node.code })}>新增子模块</Button><Button type="link" onClick={() => edit({ node: null, nodeType: 'action', parentCode: node.code })}>新增权限</Button></>}</Space> },
    ]} />
    {editing && <PermissionNodeEditor key={`${editing.node?.code ?? 'new'}-${editing.nodeType}-${editing.parentCode}`} {...editing} catalog={catalog} pending={save.isPending} error={save.isError ? save.error.message : undefined} onSave={persist} onCancel={() => setEditing(undefined)} />}
  </>;
}
