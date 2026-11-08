import { Alert, App, Button, Dropdown, Empty, Input, Space, Spin, Tabs, Tooltip, Tree } from 'antd';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { ArrowDown, ArrowUp, Folder, MousePointer2, PanelLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import type { PermissionNode } from '../api/permissionApi';
import { usePermissionDirectory } from '../hooks/usePermissionDirectory';
import { PermissionResourceForm } from './PermissionResourceForm';
import { PermissionResourceStatus } from './PermissionResourceStatus';
import { isMenuGroup, resourceNames } from '../permissionResources';

const blank = (nodeType: PermissionNode['nodeType'], parentCode: string | null): PermissionNode => ({ code: '', parentCode, nodeType, name: '', nameEn: '', description: '', descriptionEn: '', sortOrder: 999, visible: true, enabled: true, publicAllowed: false, builtIn: false, version: 0 });

export function PermissionManagement() {
  const { directory, save, reorder } = usePermissionDirectory();
  const { message } = App.useApp();
  const [tab, setTab] = useState('menu');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<PermissionNode>();
  const [order, setOrder] = useState<PermissionNode[]>();
  const [reset, setReset] = useState(0);
  if (directory.isPending) return <Spin />;
  if (directory.isError) return <Alert type="error" title={directory.error.message} action={<Button onClick={() => void directory.refetch()}>重试</Button>} />;
  const catalog = directory.data;
  const sorted = [...(order ?? catalog)].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const resources = sorted.filter((node) => tab === 'common' ? node.nodeType === 'common' : node.nodeType !== 'common');
  const node = draft ?? resources.find((item) => item.code === selected) ?? resources[0];
  const pending = save.isPending || reorder.isPending;
  const siblings = resources.filter((item) => node && item.parentCode === node.parentCode);
  const selectedIndex = siblings.findIndex((item) => item.code === node?.code);
  const move = (offset: number) => {
    if (!order || pending || selectedIndex < 0) return;
    const next = selectedIndex + offset;
    if (next < 0 || next >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[selectedIndex], reordered[next]] = [reordered[next], reordered[selectedIndex]];
    const ranks = new Map(reordered.map((item, index) => [item.code, index * 10]));
    setOrder(order.map((item) => ranks.has(item.code) ? { ...item, sortOrder: ranks.get(item.code)! } : item));
  };
  const create = (type: PermissionNode['nodeType'], parentCode: string | null = null) => { save.reset(); setDraft(blank(type, parentCode)); };
  const choices = [{ key: 'group', label: '类目' }, { key: 'page', label: '页面' }, { key: 'action', label: '权限' }];
  const keyword = search.trim().toLowerCase();
  const rows = (parent: string | null, inheritedMatch = false): DataNode[] => resources.filter((item) => item.parentCode === parent).flatMap((item) => {
    const matched = inheritedMatch || `${item.name} ${item.nameEn} ${item.code}`.toLowerCase().includes(keyword);
    const children = rows(item.code, matched);
    if (keyword && !matched && !children.length) return [];
    return [{ key: item.code, icon: isMenuGroup(item) ? <Folder size={15} /> : item.nodeType === 'page' ? <PanelLeft size={15} /> : <MousePointer2 size={15} />, title: <span className="permission-resource-tree-title">{isMenuGroup(item) ? <Folder size={15} /> : item.nodeType === 'page' ? <PanelLeft size={15} /> : <MousePointer2 size={15} />}<span className={!item.enabled ? 'permission-resource-disabled-type' : undefined}>{item.name}</span><small title={!item.enabled ? '已停用' : undefined}>{resourceNames[item.nodeType]}</small><PermissionResourceStatus node={item} /></span>, children }];
  });
  const drop: TreeProps['onDrop'] = (info) => {
    if (!order) return;
    const from = order.find((item) => item.code === info.dragNode.key);
    const target = order.find((item) => item.code === info.node.key);
    if (!from || !target) return;
    // 展开类目的首项上方会被树组件识别为插入父节点，而非同级间隙。
    const firstChild = !info.dropToGap && from.parentCode === target.code;
    if (!firstChild && (!info.dropToGap || from.parentCode !== target.parentCode)) return;
    const siblings = sorted.filter((item) => item.parentCode === from.parentCode && item.code !== from.code);
    const position = siblings.findIndex((item) => item.code === target.code);
    const after = info.dropPosition > Number(info.node.pos.split('-').at(-1));
    siblings.splice(firstChild ? 0 : position + (after ? 1 : 0), 0, from);
    const ranks = new Map(siblings.map((item, i) => [item.code, i * 10]));
    setOrder(order.map((item) => ranks.has(item.code) ? { ...item, sortOrder: ranks.get(item.code)! } : item));
  };
  const allowDrop: TreeProps['allowDrop'] = ({ dragNode, dropNode, dropPosition }) => {
    const from = resources.find((item) => item.code === dragNode.key);
    const target = resources.find((item) => item.code === dropNode.key);
    return !!from && !!target && from.code !== target.code && (dropPosition === 0 ? from.parentCode === target.code : from.parentCode === target.parentCode);
  };
  return <>
    <div className="permission-resource-top"><Tabs activeKey={tab} items={[{ key: 'menu', label: '菜单与权限' }, { key: 'common', label: '通用能力权限' }]} onChange={(key) => { setTab(key); setExpanded(null); setSelected(undefined); setDraft(undefined); setSearch(''); setOrder(undefined); save.reset(); reorder.reset(); }} /><div>{tab === 'common' ? <Button type="primary" icon={<Plus size={15} />} disabled={!!order || pending} onClick={() => create('common')}>新增通用权限</Button> : <Dropdown trigger={['click']} disabled={!!order || pending} menu={{ items: choices, onClick: ({ key }) => create(key as PermissionNode['nodeType'], key === 'action' ? (node?.nodeType === 'page' ? node.code : node?.nodeType === 'action' ? node.parentCode : null) : node && isMenuGroup(node) ? node.code : null) }}><Button type="primary" icon={<Plus size={15} />}>新增菜单 / 权限</Button></Dropdown>}</div></div>
    <div className="permission-resource-workspace">
      <section className="permission-resource-tree" aria-label="资源目录">
        <div className="permission-resource-tree-tools"><strong>{tab === 'menu' ? '菜单与权限层级' : '通用权限'}</strong><Space size={4}>{order && <><Tooltip title="上移"><Button size="small" aria-label="上移" icon={<ArrowUp size={14} />} disabled={pending || selectedIndex <= 0} onClick={() => move(-1)} /></Tooltip><Tooltip title="下移"><Button size="small" aria-label="下移" icon={<ArrowDown size={14} />} disabled={pending || selectedIndex < 0 || selectedIndex >= siblings.length - 1} onClick={() => move(1)} /></Tooltip><Button size="small" type="primary" loading={reorder.isPending} onClick={() => { void reorder.mutateAsync(order.map(({ code, sortOrder, version }) => ({ code, sortOrder, version }))).then(() => { setOrder(undefined); void message.success('排序已保存'); }).catch(() => undefined); }}>保存排序</Button></>}<Button size="small" type="link" disabled={pending || !!draft} onClick={() => { setOrder(order ? undefined : catalog); reorder.reset(); }}>{order ? '取消排序' : '调整排序'}</Button></Space></div>
        <Input aria-label="搜索资源" placeholder="搜索中英文名称或编码" allowClear value={search} disabled={!!order} onChange={(event) => setSearch(event.target.value)} />
        <Tree key={`${tab}-${keyword ? 'search' : 'all'}`} blockNode autoExpandParent={false} expandedKeys={resources.filter((item) => resources.some((child) => child.parentCode === item.code) && (keyword || (expanded ? expanded.includes(item.code) : isMenuGroup(item)))).map((item) => item.code)} onExpand={(keys) => setExpanded(keys.map(String))} treeData={rows(null)} selectedKeys={draft || !node ? [] : [node.code]} draggable={!!order && !pending} allowDrop={allowDrop} onDrop={drop} onSelect={(keys) => { if (keys.length && !pending) { setSelected(String(keys[0])); setDraft(undefined); save.reset(); } }} />
        {!resources.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无资源，可从右上角新增" />}
        <p className="system-muted">{order ? '拖动调整同级顺序；修改所属类目可移动菜单。' : tab === 'common' ? '在角色管理中直接勾选授权。' : '类目下新增页面，页面下新增权限。'}</p>
      </section>
      <section className="permission-resource-detail" aria-label="资源详情">
        {reorder.isError && <Alert type="error" title={reorder.error.message} />}
        {node ? <PermissionResourceForm key={`${node.code}-${node.nodeType}-${node.version}-${reset}`} node={node} creating={!!draft} catalog={catalog} pending={pending || !!order} error={save.isError ? save.error.message : undefined} onCancel={() => { setDraft(undefined); setReset((value) => value + 1); save.reset(); }} onSave={async (input) => { await save.mutateAsync({ input, creating: !!draft }); setSelected(input.code); setDraft(undefined); void message.success('配置已保存'); }} /> : <Empty description="请选择或新增资源" />}
      </section>
    </div>
  </>;
}
