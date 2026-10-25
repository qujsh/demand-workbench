import { memo, useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { Icon } from './Icons';
import { useDeleteWorkItems } from '../features/decomposition/hooks/useDeleteWorkItems';
import { isPersistedWorkItemNo } from '../features/decomposition/api/workItemApi';
import { useSaveWorkItem } from '../features/decomposition/hooks/useSaveWorkItem';

const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])]);
const editableNodes = nodes => flatten(nodes).filter(node => node.type === 'work' || node.type === 'subtask');
const updateNode = (nodes,id,change) => nodes.map(node => node.id === id ? {...node,...change} : {...node,children:updateNode(node.children || [],id,change)});
const selectBranch = (node,checked) => ({...node,selected:node.type === 'work' || node.type === 'subtask' ? checked : node.selected,children:(node.children || []).map(child=>selectBranch(child,checked))});
const updateBranchSelection = (nodes,id,checked) => nodes.map(node => node.id === id ? selectBranch(node,checked) : {...node,children:updateBranchSelection(node.children || [],id,checked)});
const removeSelected = nodes => nodes.filter(node => !((node.type === 'work' || node.type === 'subtask') && node.selected)).map(node => ({...node,children:removeSelected(node.children || [])}));
const removeNode = (nodes,id) => nodes.filter(node=>node.id!==id).map(node=>({...node,children:removeNode(node.children||[],id)}));
const appendChild = (nodes,id,child) => nodes.map(node=>node.id===id?{...node,children:[...(node.children||[]),child]}:{...node,children:appendChild(node.children||[],id,child)});
const typeMeta = {
  module: { label: '模块', prefix: 'MOD', icon: 'FolderKanban' },
  feature: { label: '功能', prefix: 'FUN', icon: 'Bookmark' },
  work: { label: '工作项', prefix: 'WORK', icon: 'SquareCheckBig' },
  subtask: { label: '子任务', prefix: 'SUB', icon: 'GitBranch' },
};

export default function Planning({ title,modules,setModules,onBack,decompositionNo }){
  return <main className="page planning-page"><header className="topbar"><button className="back" onClick={onBack}><Icon name="ArrowLeft"/>需求分析</button><span>/</span><strong>{title || '未命名需求标题'} · 项目规划</strong><span className="spacer"/><button className="ghost"><Icon name="Import"/>导入</button></header><PlanningWorkspace title={title} modules={modules} setModules={setModules} decompositionNo={decompositionNo} emptyPrimaryLabel="返回需求分析" onEmptyPrimary={onBack}/></main>;
}

function PlanningWorkspaceComponent({ title,modules,setModules,decompositionNo,embedded=false,emptyPrimaryLabel,onEmptyPrimary }){
  const deleteWorkItemsMutation=useDeleteWorkItems();
  const saveWorkItemMutation=useSaveWorkItem();
  const [mode,setMode]=useState('tree');
  const [open,setOpen]=useState(()=>Object.fromEntries(flatten(modules).filter(node=>node.children?.length).map(node=>[node.id,true])));
  const [editing,setEditing]=useState(null);
  const [deleteConfirmOpen,setDeleteConfirmOpen]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [menuOpen,setMenuOpen]=useState(null);
  const [menuPlacement,setMenuPlacement]=useState('down');
  const [inlineOpen,setInlineOpen]=useState(null);
  const [calendarOpen,setCalendarOpen]=useState(null);
  const all=editableNodes(modules);
  const selected=all.filter(node=>node.selected);
  const allSelected=all.length>0&&selected.length===all.length;
  const partiallySelected=selected.length>0&&!allSelected;
  const toggleBranch=(id,checked)=>setModules(nodes=>updateBranchSelection(nodes,id,checked));
  const toggleAll=checked=>setModules(nodes=>nodes.map(node=>selectBranch(node,checked)));
  const openEditor=node=>setEditing({...node,status:node.status||'未开始',role:node.role||'',priority:node.priority||'',startDate:node.startDate||'',endDate:node.endDate||'',description:node.description||node.acceptance||'',dependency:node.dependency||''});
  const updateInline=async(node,field,value)=>{if(!decompositionNo){notify('请先完成工作项拆解');return;}try{const saved=await saveWorkItemMutation.mutateAsync({decompositionNo,node:{...node,[field]:value},isNew:false});setModules(nodes=>updateNode(nodes,node.id,saved));setEditing(current=>current?.id===node.id?{...current,...saved}:current);}catch(error){notify(error instanceof Error?error.message:'工作项保存失败，请稍后重试');}};
  const notify=message=>window.dispatchEvent(new CustomEvent('toast',{detail:message}));
  const requestBatchDelete=()=>{setDeleteTarget(null);setDeleteConfirmOpen(true);};
  const requestNodeDelete=node=>{setMenuOpen(null);setDeleteTarget(node);setDeleteConfirmOpen(true);};
  const toggleMoreMenu=(event,nodeId)=>{event.stopPropagation();if(menuOpen===nodeId){setMenuOpen(null);return;}const triggerRect=event.currentTarget.getBoundingClientRect();const tableRect=event.currentTarget.closest('.work-table')?.getBoundingClientRect();const lowerBoundary=Math.min(window.innerHeight,tableRect?.bottom??window.innerHeight);setMenuPlacement(lowerBoundary-triggerRect.bottom<82?'up':'down');setMenuOpen(nodeId);};
  const confirmDelete=async()=>{const targets=deleteTarget?flatten([deleteTarget]):selected;const persistedNos=targets.map(node=>node.id).filter(isPersistedWorkItemNo);try{if(persistedNos.length){const result=await deleteWorkItemsMutation.mutateAsync(persistedNos);if(result.deletedCount===0)throw new Error('后端未找到对应工作项，请刷新页面后重试');}setModules(nodes=>deleteTarget?removeNode(nodes,deleteTarget.id):removeSelected(nodes));setDeleteConfirmOpen(false);setDeleteTarget(null);notify(`已删除 ${targets.length} 个工作项`);}catch(error){notify(error instanceof Error?error.message:'工作项删除失败，请稍后重试');}};
  const copyNode=async node=>{const meta=typeMeta[node.type]||typeMeta.work;const text=[`${meta.label}：${node.name}`,node.status&&`状态：${node.status}`,node.role&&`角色：${node.role}`,node.startDate&&`开始时间：${node.startDate}`,node.endDate&&`结束时间：${node.endDate}`,(node.description||node.acceptance)&&`功能描述：${node.description||node.acceptance}`].filter(Boolean).join('\n');await navigator.clipboard.writeText(text);setMenuOpen(null);notify('工作项文本已复制');};
  const openCreate=(type='work',parentId=null)=>{const meta=typeMeta[type]||typeMeta.work;const stamp=Date.now();setEditing({id:`${meta.prefix.toLowerCase()}-${stamp}`,type,name:'',children:[],status:'未开始',role:'',priority:'',startDate:'',endDate:'',description:'',dependency:'',selected:false,isNew:true,parentId});};
  const addChild=node=>{const childType={module:'feature',feature:'work',work:'subtask'}[node.type];if(childType)openCreate(childType,node.id);};
  useEffect(()=>{const close=()=>{setMenuOpen(null);setInlineOpen(null);setCalendarOpen(null)};document.addEventListener('click',close);return()=>document.removeEventListener('click',close);},[]);
  useEffect(()=>{setOpen(current=>({...Object.fromEntries(flatten(modules).filter(node=>node.children?.length).map(node=>[node.id,true])),...current}));},[modules]);
  let visibleRowIndex=0;
  const saveEditing=async draft=>{if(!draft.name.trim()){notify('请填写名称');return;}if(!decompositionNo){notify('请先完成工作项拆解');return;}const {isNew,parentId,...payload}=draft;try{const saved=await saveWorkItemMutation.mutateAsync({decompositionNo,parentWorkItemNo:parentId,node:payload,isNew:Boolean(isNew)});if(isNew){setModules(nodes=>parentId?appendChild(nodes,parentId,saved):[...nodes,saved]);if(parentId)setOpen(current=>({...current,[parentId]:true}));}else{setModules(nodes=>updateNode(nodes,draft.id,saved));}setEditing(null);notify(isNew?'工作项已新增':'工作项已保存');}catch(error){notify(error instanceof Error?error.message:'工作项保存失败，请稍后重试');}};

  const renderNode=(node,level,ancestorContinues=[],isLast=false)=>{
    const sequence=++visibleRowIndex;
    const children=node.children || [];
    const descendants=editableNodes([node]);
    const selectedCount=descendants.filter(item=>item.selected).length;
    const fullySelected=descendants.length>0 && selectedCount===descendants.length;
    const partiallySelected=selectedCount>0 && !fullySelected;
    const meta=typeMeta[node.type] || typeMeta.work;
    const code=`${meta.prefix}-${String(node.id).replace(/\D/g,'').padStart(3,'0')}`;
    return <div className="work-branch" key={node.id}>
      <div className={`work-row hierarchy-row level-${level} ${fullySelected?'selected':''}`}>
        <span className={`sequence-cell ${fullySelected||partiallySelected?'is-selected':''}`}>
          <span className="row-number">{sequence}</span>
          <input ref={input=>{if(input)input.indeterminate=partiallySelected}} type="checkbox" aria-label={`选择${node.name}`} checked={fullySelected} onChange={event=>toggleBranch(node.id,event.target.checked)}/>
        </span>
        <span className="tree-name" style={{'--tree-level':level}}>
          {ancestorContinues.map((continues,index)=><span className={`tree-guide ${continues?'continues':''}`} key={`${node.id}-guide-${index}`} aria-hidden="true"/>)}
          {level>0&&<span className={`tree-elbow ${isLast?'last':''}`} aria-hidden="true"/>}
          {children.length?<button className="tree-toggle" aria-label={open[node.id]?'收起子项':'展开子项'} onClick={()=>setOpen(current=>({...current,[node.id]:!current[node.id]}))}><Icon name={open[node.id]?'ChevronDown':'ChevronRight'} size={15}/></button>:<span className="tree-toggle-placeholder"/>}
          <span className={`type-icon ${node.type}-icon`}><Icon name={meta.icon} size={13}/></span>
          <button className="work-title" onClick={()=>openEditor(node)}><small>{code} · {meta.label}</small><strong>{node.name}</strong></button>
          {children.length>0&&<em>{children.length}</em>}
          <span className="row-actions">
            {node.type!=='subtask'&&<Tooltip title="添加子项" mouseEnterDelay={0}><button className="hover-action" aria-label={`为${node.name}添加子项`} onClick={()=>addChild(node)}><Icon name="Plus" size={15}/></button></Tooltip>}
            <Tooltip title="编辑" mouseEnterDelay={0}><button className="hover-action" aria-label={`编辑${node.name}`} onClick={()=>openEditor(node)}><Icon name="Pencil" size={14}/></button></Tooltip>
            <Tooltip title="更多" mouseEnterDelay={0.05}><button className={`row-action ${menuOpen===node.id?'active':''}`} aria-label={`${node.name}的更多操作`} onClick={event=>toggleMoreMenu(event,node.id)}><Icon name="MoreHorizontal" size={16}/></button></Tooltip>
            {menuOpen===node.id&&<span className={`row-action-menu ${menuPlacement==='up'?'open-up':''}`} onClick={event=>event.stopPropagation()}><button onClick={()=>copyNode(node)}><Icon name="Copy" size={14}/>复制文本</button><button className="delete" onClick={()=>requestNodeDelete(node)}><Icon name="Trash2" size={14}/>删除</button></span>}
          </span>
        </span>
        <span className="inline-cell"><InlineSelect ariaLabel={`${node.name}状态`} value={node.status||'未开始'} options={['未开始','待开发','进行中','待验收','已完成']} tone={`status-${node.status||'未开始'}`} open={inlineOpen===`${node.id}-status`} onToggle={event=>{event.stopPropagation();setCalendarOpen(null);setInlineOpen(current=>current===`${node.id}-status`?null:`${node.id}-status`)}} onChange={value=>{updateInline(node,'status',value);setInlineOpen(null)}}/></span>
        <span className="inline-cell"><InlineSelect ariaLabel={`${node.name}角色`} value={node.role||''} emptyLabel="未分配" options={['产品设计','前端开发','后端开发','测试']} open={inlineOpen===`${node.id}-role`} onToggle={event=>{event.stopPropagation();setCalendarOpen(null);setInlineOpen(current=>current===`${node.id}-role`?null:`${node.id}-role`)}} onChange={value=>{updateInline(node,'role',value);setInlineOpen(null)}}/></span>
        <span className="inline-cell"><InlineDatePicker ariaLabel={`${node.name}开始时间`} value={node.startDate||''} open={calendarOpen===`${node.id}-startDate`} onToggle={event=>{event.stopPropagation();setInlineOpen(null);setCalendarOpen(current=>current===`${node.id}-startDate`?null:`${node.id}-startDate`)}} onChange={value=>{updateInline(node,'startDate',value);setCalendarOpen(null)}}/></span>
        <span className="inline-cell"><InlineDatePicker ariaLabel={`${node.name}结束时间`} value={node.endDate||''} open={calendarOpen===`${node.id}-endDate`} onToggle={event=>{event.stopPropagation();setInlineOpen(null);setCalendarOpen(current=>current===`${node.id}-endDate`?null:`${node.id}-endDate`)}} onChange={value=>{updateInline(node,'endDate',value);setCalendarOpen(null)}}/></span>
        <span className="inline-cell"><InlineSelect ariaLabel={`${node.name}优先级`} value={node.priority||''} emptyLabel="未设置" options={['高','中','低']} tone={`priority-${node.priority||'无'}`} open={inlineOpen===`${node.id}-priority`} onToggle={event=>{event.stopPropagation();setCalendarOpen(null);setInlineOpen(current=>current===`${node.id}-priority`?null:`${node.id}-priority`)}} onChange={value=>{updateInline(node,'priority',value);setInlineOpen(null)}}/></span>
      </div>
      {children.length>0&&open[node.id]&&children.map((child,index)=>renderNode(child,level+1,[...ancestorContinues,...(level>0?[!isLast]:[])],index===children.length-1))}
    </div>;
  };

  return <div className={`planning-workspace ${embedded?'embedded':''}`}>
    <section className="plan-head"><div><div className="title-line"><h1>{title || '未命名需求标题'}</h1><b className="status blue">规划中</b></div><p>{modules.length} 个模块 · {all.filter(node=>node.type==='work').length} 个工作项 · {all.filter(node=>node.type==='subtask').length} 个子任务</p></div><button className="primary" onClick={()=>openCreate('work')}><Icon name="Plus"/>新增工作项</button></section>
    <div className="viewbar"><div className="segmented"><button className={mode==='tree'?'active':''} onClick={()=>setMode('tree')}><Icon name="ListTree"/>工作项树</button><button className={mode==='gantt'?'active':''} onClick={()=>setMode('gantt')}><Icon name="ChartNoAxesGantt"/>甘特图</button></div><button className="batch-delete" disabled={!selected.length} onClick={requestBatchDelete}><Icon name="Trash2"/>批量删除{selected.length>0&&<b>{selected.length}</b>}</button><button><Icon name="Filter"/>筛选</button><button><Icon name="ArrowUpDown"/>排序</button></div>
    {!modules.length?<WorkTreeEmpty onCreate={()=>openCreate('work')} primaryLabel={emptyPrimaryLabel} onPrimary={onEmptyPrimary}/>:mode==='tree'?<div className="work-table hierarchy-table"><div className="work-head"><span className="head-selection"><input ref={input=>{if(input)input.indeterminate=partiallySelected}} type="checkbox" title="全选工作项" aria-label="全选工作项" checked={allSelected} onChange={event=>toggleAll(event.target.checked)}/></span><span>工作项</span><span>状态</span><span>角色</span><span>开始时间</span><span>结束时间</span><span>优先级</span></div>{modules.map((node,index)=>renderNode(node,0,[],index===modules.length-1))}</div>:<Gantt modules={modules} onEdit={openEditor}/>} 
    {editing&&<WorkItemEditorDrawer initialValue={editing} saving={saveWorkItemMutation.isPending} onClose={()=>setEditing(null)} onSave={saveEditing}/>} 
    {deleteConfirmOpen&&<div className="modal-backdrop" role="presentation" onMouseDown={()=>{if(!deleteWorkItemsMutation.isPending){setDeleteConfirmOpen(false);setDeleteTarget(null)}}}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-work-items-title" onMouseDown={event=>event.stopPropagation()}><span className="confirm-icon delete-icon"><Icon name="Trash2"/></span><h2 id="delete-work-items-title">{deleteTarget?`删除“${deleteTarget.name}”？`:'删除选中的工作项？'}</h2><p>{deleteTarget?'该节点及其全部子项将被删除，此操作无法撤销。':`将删除选中的 ${selected.length} 个工作项及其子任务，此操作无法撤销。`}</p><footer><button disabled={deleteWorkItemsMutation.isPending} onClick={()=>{setDeleteConfirmOpen(false);setDeleteTarget(null)}}>取消</button><button className="danger-button" disabled={deleteWorkItemsMutation.isPending} onClick={()=>void confirmDelete()}>{deleteWorkItemsMutation.isPending?'正在删除':'确认删除'}</button></footer></section></div>}
  </div>;
}

export const PlanningWorkspace = memo(PlanningWorkspaceComponent);

const WorkItemEditorDrawer = memo(function WorkItemEditorDrawer({initialValue,saving,onClose,onSave}){
  const [draft,setDraft]=useState(initialValue);
  const [openSelect,setOpenSelect]=useState(null);
  const [openCalendar,setOpenCalendar]=useState(null);
  const meta=typeMeta[draft.type]||typeMeta.work;
  const update=(field,value)=>setDraft(current=>({...current,[field]:value}));

  return <aside className="drawer work-drawer simple-drawer"><div className="drawer-head"><div><small>{draft.isNew?'新增':'编辑'}{meta.label} · {draft.id.toUpperCase()}</small><h2>{draft.name||`未命名${meta.label}`}</h2></div><button className="icon-btn" aria-label="关闭抽屉" onClick={onClose}><Icon name="X"/></button></div><div className="drawer-tab-title">基本信息</div><div className="drawer-body"><label className="drawer-field">名称<span className="required" aria-label="必填">*</span><input autoFocus={draft.isNew} placeholder={`请输入${meta.label}名称`} value={draft.name} onChange={event=>update('name',event.target.value)}/></label><div className="form-grid"><DrawerSelect label="状态" value={draft.status} options={['未开始','待开发','进行中','待验收','已完成']} tone={`status-${draft.status}`} fieldKey="drawer-status" openKey={openSelect} setOpenKey={setOpenSelect} onChange={value=>update('status',value)}/><DrawerSelect label="角色" value={draft.role} emptyLabel="未分配" options={['产品设计','前端开发','后端开发','测试']} fieldKey="drawer-role" openKey={openSelect} setOpenKey={setOpenSelect} onChange={value=>update('role',value)}/></div><div className="form-grid"><DrawerDate label="开始时间" value={draft.startDate} fieldKey="drawer-start" openKey={openCalendar} setOpenKey={setOpenCalendar} onChange={value=>update('startDate',value)}/><DrawerDate label="结束时间" value={draft.endDate} fieldKey="drawer-end" openKey={openCalendar} setOpenKey={setOpenCalendar} onChange={value=>update('endDate',value)}/></div><DrawerSelect label="优先级" value={draft.priority} emptyLabel="未设置" options={['高','中','低']} tone={`priority-${draft.priority||'无'}`} fieldKey="drawer-priority" openKey={openSelect} setOpenKey={setOpenSelect} onChange={value=>update('priority',value)}/><label className="drawer-field">功能描述<textarea placeholder="请描述需要实现的功能、使用场景和关键约束" value={draft.description} onChange={event=>update('description',event.target.value)}/></label><div className="drawer-divider"><span>关联依赖</span></div><DrawerSelect label="前置依赖" value={draft.dependency} emptyLabel="无前置依赖" options={['服务项目列表','门店列表']} fieldKey="drawer-dependency" openKey={openSelect} setOpenKey={setOpenSelect} onChange={value=>update('dependency',value)}/></div><div className="drawer-footer"><button disabled={saving} onClick={onClose}>取消</button><button className="primary" disabled={saving} onClick={()=>onSave(draft)}>{saving?'保存中':draft.isNew?'新增':'保存'}</button></div></aside>;
});

function WorkTreeEmpty({onCreate,primaryLabel,onPrimary}){
  return <section className="work-tree-empty">
    <div className="empty-tree-visual" aria-hidden="true"><span className="empty-tree-root"><Icon name="ListTree" size={20}/></span><i/><i/><i/></div>
    <h2>暂无工作项</h2>
    <p>拆解完成后，模块、功能、工作项和子任务将在这里形成结构化工作项树。</p>
    <div className="empty-tree-actions">{onPrimary&&<button className="primary" onClick={onPrimary}><Icon name={primaryLabel==='返回需求分析'?'ArrowLeft':'Sparkles'} size={15}/>{primaryLabel}</button>}<button onClick={onCreate}><Icon name="Plus" size={15}/>手动新增</button></div>
  </section>;
}

function DrawerSelect({label,value,options,emptyLabel,tone='',fieldKey,openKey,setOpenKey,onChange}){
  return <label className="drawer-field">{label}<InlineSelect ariaLabel={label} value={value} options={options} emptyLabel={emptyLabel} tone={tone} open={openKey===fieldKey} onToggle={event=>{event.stopPropagation();setOpenKey(current=>current===fieldKey?null:fieldKey)}} onChange={next=>{onChange(next);setOpenKey(null)}}/></label>;
}

function DrawerDate({label,value,fieldKey,openKey,setOpenKey,onChange}){
  return <label className="drawer-field">{label}<InlineDatePicker ariaLabel={label} value={value} open={openKey===fieldKey} onToggle={event=>{event.stopPropagation();setOpenKey(current=>current===fieldKey?null:fieldKey)}} onChange={next=>{onChange(next);setOpenKey(null)}}/></label>;
}

function Gantt({modules,onEdit}){
  const allItems=editableNodes(modules);
  const items=allItems.filter(node=>node.startDate&&node.endDate);
  const unscheduledCount=allItems.length-items.length;
  const dayMs=86400000;
  const parse=value=>new Date(`${value}T00:00:00`);
  const dated=items.map(node=>({...node,start:parse(node.startDate),end:parse(node.endDate)}));
  if(!dated.length)return <div className="gantt-empty gantt-empty-state"><Icon name="CalendarRange"/><strong>暂无已排期工作项</strong><span>{allItems.length?`${allItems.length} 个工作项尚未设置开始和结束时间`:'新增工作项并设置时间后，将在此显示排期'}</span></div>;
  const rawMin=dated.length?new Date(Math.min(...dated.map(item=>item.start))):new Date();
  const rawMax=dated.length?new Date(Math.max(...dated.map(item=>item.end))):new Date(rawMin.getTime()+6*dayMs);
  const rangeStart=new Date(rawMin); rangeStart.setDate(rangeStart.getDate()-1);
  const rangeEnd=new Date(rawMax); rangeEnd.setDate(rangeEnd.getDate()+1);
  const dayCount=Math.max(7,Math.round((rangeEnd-rangeStart)/dayMs)+1);
  const days=Array.from({length:dayCount},(_,index)=>new Date(rangeStart.getTime()+index*dayMs));
  const today=new Date(); today.setHours(0,0,0,0);
  const offset=date=>Math.round((date-rangeStart)/dayMs);
  const statusClass=status=>({'未开始':'not-started','待开发':'pending','进行中':'doing','待验收':'review','已完成':'done'}[status]||'not-started');
  return <div className="gantt-shell">{unscheduledCount>0&&<div className="gantt-unscheduled-note"><Icon name="CalendarRange" size={14}/>{unscheduledCount} 个工作项待排期</div>}<div className="gantt-grid" style={{'--day-count':dayCount}}>
    <div className="gantt-corner"><strong>工作项</strong><span>{items.length} 项</span></div>
    <div className="gantt-calendar-head"><div className="gantt-month">{rangeStart.getFullYear()}年{rangeStart.getMonth()+1}月</div><div className="gantt-days">{days.map(day=><span className={day.getDay()===0||day.getDay()===6?'weekend':''} key={day.toISOString()}><b>{day.getDate()}</b><small>{['日','一','二','三','四','五','六'][day.getDay()]}</small></span>)}</div></div>
    {dated.map(item=><div className="gantt-row" key={item.id}>
      <button className="gantt-item" onClick={()=>onEdit(item)}><span className={`type-icon ${item.type}-icon`}><Icon name={(typeMeta[item.type]||typeMeta.work).icon} size={12}/></span><span><strong>{item.name}</strong><small>{item.role||'未分配'} · {item.status||'未开始'}</small></span></button>
      <div className="gantt-track"><div className="gantt-day-lines">{days.map(day=><i className={day.getDay()===0||day.getDay()===6?'weekend':''} key={day.toISOString()}/>)}</div>{today>=rangeStart&&today<=rangeEnd&&<span className="gantt-today" style={{left:`calc(${offset(today)} * (100% / var(--day-count)) + 50% / var(--day-count))`}}/>}<button className={`gantt-bar ${statusClass(item.status)}`} style={{left:`calc(${offset(item.start)} * 100% / var(--day-count) + 3px)`,width:`calc(${Math.max(1,offset(item.end)-offset(item.start)+1)} * 100% / var(--day-count) - 6px)`}} title={`${item.name}：${item.startDate} 至 ${item.endDate}`} onClick={()=>onEdit(item)}><span>{item.name}</span></button></div>
    </div>)}
  </div></div>;
}

function InlineSelect({value,options,emptyLabel,ariaLabel,tone='',open,onToggle,onChange}){
  const [openUp,setOpenUp]=useState(false);
  const items=emptyLabel?[{value:'',label:emptyLabel},...options.map(item=>({value:item,label:item}))]:options.map(item=>({value:item,label:item}));
  const label=value||emptyLabel;
  const handleToggle=event=>{
    if(!open){
      const triggerRect=event.currentTarget.getBoundingClientRect();
      const tableRect=event.currentTarget.closest('.work-table')?.getBoundingClientRect();
      const lowerBoundary=Math.min(window.innerHeight,tableRect?.bottom??window.innerHeight);
      const menuHeight=items.length*34+12;
      const spaceBelow=lowerBoundary-triggerRect.bottom;
      setOpenUp(spaceBelow<menuHeight&&triggerRect.top>spaceBelow);
    }
    onToggle(event);
  };
  return <span className="custom-field" onClick={event=>event.stopPropagation()}>
    <button className={`custom-field-trigger ${tone} ${open?'open':''}`} type="button" aria-label={ariaLabel} aria-expanded={open} onClick={handleToggle}><span>{label}</span><Icon name="ChevronDown" size={13}/></button>
    {open&&<span className={`custom-select-menu ${openUp?'open-up':''}`}>{items.map(item=><button className={item.value===value?'selected':''} type="button" key={item.value||'empty'} onClick={()=>onChange(item.value)}><span>{item.label}</span>{item.value===value&&<Icon name="Check" size={13}/>}</button>)}</span>}
  </span>;
}

function InlineDatePicker({value,ariaLabel,open,onToggle,onChange}){
  const initial=value?new Date(`${value}T00:00:00`):new Date();
  const [viewDate,setViewDate]=useState(()=>new Date(initial.getFullYear(),initial.getMonth(),1));
  const [openUp,setOpenUp]=useState(false);
  useEffect(()=>{
    if(open){
      const active=value?new Date(`${value}T00:00:00`):new Date();
      setViewDate(new Date(active.getFullYear(),active.getMonth(),1));
    }
  },[open,value]);
  const year=viewDate.getFullYear();
  const month=viewDate.getMonth();
  const firstOffset=(new Date(year,month,1).getDay()+6)%7;
  const daysInMonth=new Date(year,month+1,0).getDate();
  const previousDays=new Date(year,month,0).getDate();
  const pad=number=>String(number).padStart(2,'0');
  const toValue=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const cells=Array.from({length:42},(_,index)=>{
    const day=index-firstOffset+1;
    if(day<1)return new Date(year,month-1,previousDays+day);
    if(day>daysInMonth)return new Date(year,month+1,day-daysInMonth);
    return new Date(year,month,day);
  });
  const display=value?value.replaceAll('-','/'):'未设置';
  const todayValue=toValue(new Date());
  const handleToggle=event=>{
    if(!open){
      const triggerRect=event.currentTarget.getBoundingClientRect();
      const tableRect=event.currentTarget.closest('.work-table')?.getBoundingClientRect();
      const lowerBoundary=Math.min(window.innerHeight,tableRect?.bottom??window.innerHeight);
      const spaceBelow=lowerBoundary-triggerRect.bottom;
      setOpenUp(spaceBelow<300&&triggerRect.top>spaceBelow);
    }
    onToggle(event);
  };
  return <span className="custom-field date-field" onClick={event=>event.stopPropagation()}>
    <button className={`custom-field-trigger date-trigger ${open?'open':''}`} type="button" aria-label={ariaLabel} aria-expanded={open} onClick={handleToggle}><span>{display}</span><Icon name="CalendarDays" size={13}/></button>
    {open&&<span className={`calendar-popover ${openUp?'open-up':''}`}>
      <span className="calendar-head"><strong>{year}年{month+1}月</strong><span><button type="button" aria-label="上个月" onClick={()=>setViewDate(new Date(year,month-1,1))}><Icon name="ChevronLeft" size={15}/></button><button type="button" aria-label="下个月" onClick={()=>setViewDate(new Date(year,month+1,1))}><Icon name="ChevronRight" size={15}/></button></span></span>
      <span className="calendar-week">{['一','二','三','四','五','六','日'].map(day=><b key={day}>{day}</b>)}</span>
      <span className="calendar-grid">{cells.map(date=>{const cellValue=toValue(date);const outside=date.getMonth()!==month;return <button type="button" className={`${outside?'outside':''} ${cellValue===value?'selected':''} ${cellValue===todayValue?'today':''}`} key={cellValue} onClick={()=>onChange(cellValue)}>{date.getDate()}</button>})}</span>
      <span className="calendar-footer"><button type="button" onClick={()=>onChange('')}>清除</button><button type="button" onClick={()=>onChange(todayValue)}>今天</button></span>
    </span>}
  </span>;
}
