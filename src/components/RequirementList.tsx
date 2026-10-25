import { useMemo, useState } from 'react';
import { Modal } from 'antd';
import type { Requirement } from '../shared/types/workItem';
import { Icon } from './Icons';

const statusClass: Record<Requirement['stage'], string> = {
  草稿: 'gray', 已发布: 'green', 已取消: 'gray',
};

interface Props {
  requirements: Requirement[];
  onOpen: (item: Requirement) => void;
  onCreate: () => void;
  onPublish: (item: Requirement) => void;
  onDelete: (item: Requirement) => Promise<void>;
  onCancel: (item: Requirement) => Promise<void>;
  publishingRequirementId?: string;
  deletingRequirementId?: string;
  cancellingRequirementId?: string;
  isPublishing: boolean;
  isDeleting: boolean;
  isCancelling: boolean;
  isLoading: boolean;
  loadError: Error | null;
  onRetry: () => void;
}

export default function RequirementList({
  requirements, onOpen, onCreate, onPublish, onDelete, onCancel,
  publishingRequirementId, deletingRequirementId, cancellingRequirementId,
  isPublishing, isDeleting, isCancelling, isLoading, loadError, onRetry,
}: Props) {
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Requirement | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Requirement | null>(null);
  const filtered = useMemo(() => requirements.filter((item) =>
    item.title.includes(query) || item.id.toLowerCase().includes(query.toLowerCase())),
  [requirements, query]);

  return <main className="page requirements-page">
    <header className="topbar"><div className="crumb">需求管理</div><div className="top-actions"><button className="icon-btn" title="通知"><Icon name="Bell" /></button><span className="avatar">林</span></div></header>
    <section className="page-head"><div><h1>需求管理</h1><p>集中管理需求分析进度，并从需求直接创建发布任务。</p></div><button className="primary" onClick={onCreate}><Icon name="Plus" />新建需求</button></section>
    <div className="toolbar"><div className="search"><Icon name="Search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索需求" /></div><button><Icon name="ListFilter" />筛选</button><button><Icon name="ArrowUpDown" />最近更新</button><span className="spacer" /><button className="icon-btn"><Icon name="List" /></button><button className="icon-btn muted"><Icon name="LayoutGrid" /></button></div>
    <div className="list-shell">
      <div className="list-header"><span>需求</span><span>当前阶段</span><span>工作项</span><span>最后更新</span><span>操作</span></div>
      {isLoading && <div className="requirements-state"><Icon name="LoaderCircle" className="spin" size={22} /><strong>正在加载需求</strong><small>正在同步后端数据...</small></div>}
      {!isLoading && loadError && <div className="requirements-state error"><Icon name="CircleAlert" size={22} /><strong>需求列表加载失败</strong><small>{loadError.message === 'Failed to fetch' ? '无法连接后端服务，请确认服务已启动' : loadError.message}</small><button className="ghost" onClick={onRetry}>重新加载</button></div>}
      {!isLoading && !loadError && filtered.map((item) => {
        return <div className="requirement-row" key={item.id} role="link" tabIndex={0} onClick={() => onOpen(item)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(item); } }}>
          <span className="req-title"><i><Icon name="FileText" size={16} /></i><span><strong>{item.title}</strong><small>{item.id.startsWith('LOCAL-') ? '保存后生成需求编号' : item.id}</small></span></span>
          <span className="stage-cell" onClick={(event) => event.stopPropagation()}>
            <b className={`status ${statusClass[item.stage]}`}>{item.stage}</b>
          </span>
          <span className="scale"><strong>{item.modules}</strong> 个模块 · <strong>{item.items}</strong> 个功能项</span>
          <span className="updated-at">{item.updated}</span>
          <span className="row-actions">
            {item.stage !== '已发布' && <button className="publish-entry" disabled={isPublishing || isDeleting || isCancelling} onClick={(event) => { event.stopPropagation(); onPublish(item); }}><Icon name={isPublishing && publishingRequirementId === item.id ? 'LoaderCircle' : 'Send'} className={isPublishing && publishingRequirementId === item.id ? 'spin' : ''} size={14} />{isPublishing && publishingRequirementId === item.id ? '正在保存' : '任务发布'}</button>}
            {item.stage === '已发布' && <button className="cancel-entry" disabled={isCancelling || isDeleting} onClick={(event) => { event.stopPropagation(); setCancelTarget(item); }}>{isCancelling && cancellingRequirementId === item.id && <Icon name="LoaderCircle" className="spin" size={14} />}{isCancelling && cancellingRequirementId === item.id ? '取消中' : '取消'}</button>}
            <button className="delete-entry" title="删除需求" aria-label={`删除需求：${item.title}`} disabled={isPublishing || isDeleting || isCancelling} onClick={(event) => { event.stopPropagation(); setDeleteTarget(item); }}><Icon name={isDeleting && deletingRequirementId === item.id ? 'LoaderCircle' : 'Trash2'} className={isDeleting && deletingRequirementId === item.id ? 'spin' : ''} size={15} /></button><span className="open-entry" aria-hidden="true"><Icon name="ChevronRight" size={16} /></span>
          </span>
        </div>;
      })}
      {!isLoading && !loadError && !filtered.length && <div className="empty"><Icon name="SearchX" size={28} /><p>{query ? '没有找到相关需求' : '暂无需求，点击“新建需求”开始录入'}</p></div>}
    </div>
    <Modal open={Boolean(deleteTarget)} title="删除需求" okText="删除" cancelText="取消" okButtonProps={{ danger: true, loading: isDeleting }} onCancel={() => { if (!isDeleting) setDeleteTarget(null); }} onOk={async () => { if (!deleteTarget) return; await onDelete(deleteTarget); setDeleteTarget(null); }} destroyOnHidden>
      <p className="delete-confirm-text">删除后，该需求将不再出现在需求列表中。</p>
      {deleteTarget && <div className="delete-confirm-target"><Icon name="FileText" size={16} /><span>{deleteTarget.title}</span></div>}
    </Modal>
    <Modal open={Boolean(cancelTarget)} title="取消任务" okText="确认取消" cancelText="返回" okButtonProps={{ danger: true, loading: isCancelling }} onCancel={() => { if (!isCancelling) setCancelTarget(null); }} onOk={async () => { if (!cancelTarget) return; await onCancel(cancelTarget); setCancelTarget(null); }} destroyOnHidden>
      <p className="delete-confirm-text">取消后任务将停止发布，且不能直接恢复。</p>
      {cancelTarget && <div className="delete-confirm-target"><Icon name="FileText" size={16} /><span>{cancelTarget.title}</span></div>}
    </Modal>
  </main>;
}
