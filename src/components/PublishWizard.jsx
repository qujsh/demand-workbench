import { useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker, Select, Modal, Checkbox } from 'antd';
import dayjs from 'dayjs';
import { Icon } from './Icons';
import {
  buildPublicProject,
  publicationContent,
  rewardLabel,
  countProjectTasks,
  publicationEditorState,
} from '../features/publishing/components/publicationPreviewModel';
import { PublicTaskPreview } from '../features/publishing/components/PublicTaskPreview';
import { ProjectPublicationFields } from '../features/publishing/components/ProjectPublicationFields';
import { getManagedTaskCategories } from '../features/publishing/api/taskContentApi';
import { useQuery } from '@tanstack/react-query';
import { useDecompositionTask } from '../features/decomposition/hooks/useDecompositionTask';
import { usePublishSummary } from '../features/publishing/hooks/usePublishSummary';
import { TaskCategorySelect } from '../features/publishing/components/TaskCategorySelect';
import { TaskContentFields } from '../features/publishing/components/TaskContentFields';
import { emptyTaskContent } from '../features/publishing/components/taskContentDefaults';
import { RecruitmentManagement } from '../features/publishing/components/RecruitmentManagement';
import { PublicationHistory } from '../features/publishing/components/PublicationHistory';
import { usePublishTask } from '../features/publishing/hooks/usePublishTask';

const steps = ['发布内容', '承接要求', '确认发布'];
const options = (values) => values.map((value) => ({ label: value, value }));

const validDates = (items, key) =>
  items
    .map((item) => item[key])
    .filter(Boolean)
    .sort();

const flattenNodes = (nodes) =>
  nodes.flatMap((node) => [node, ...flattenNodes(node.children || [])]);

export default function PublishWizard({ requirement, selected, modules, onBack, onDone, onManageCategories }) {
  const [fullPreview, setFullPreview] = useState(false);
  const [modal, modalHolder] = Modal.useModal();
  const publishSummary = usePublishSummary(requirement.id);
  const publishTask = usePublishTask(requirement.id);
  const summaryTouched = useRef(false);
  const restoredTaskNo = useRef(null);
  const formScrollRef = useRef(null);
  const decompositionQuery = useDecompositionTask(
    modules.length ? undefined : requirement.currentDecompositionNo,
  );
  const workItemTree = useMemo(
    () => (modules.length ? modules : decompositionQuery.task?.modules || []),
    [decompositionQuery.task?.modules, modules],
  );
  const initialRoles = useMemo(
    () => [...new Set(selected.map((item) => item.role).filter(Boolean))].join('、'),
    [selected],
  );
  const initialStartDates = useMemo(() => validDates(selected, 'startDate'), [selected]);
  const initialEndDates = useMemo(() => validDates(selected, 'endDate'), [selected]);
  const [step, setStep] = useState(0);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [includedItems, setIncludedItems] = useState(selected);
  const includedIds = useMemo(() => new Set(includedItems.map((item) => item.id)), [includedItems]);
  const [data, setData] = useState({
    title: requirement.title || '',
    category: '',
    summary: '',
    skills: initialRoles,
    experience: '不限',
    recruitCount: '1',
    budget: '',
    startDate: initialStartDates[0] || '',
    deadline: initialEndDates.at(-1) || '',
    mode: '远程',
    recruit: '报名审核',
    visibility: '所有人可见',
    content: emptyTaskContent(),
    invitedUserNos: [],
    version: 0,
  });
  const set = (key, value) => setData((current) => ({ ...current, [key]: value }));
  const categoryQuery = useQuery({
    queryKey: ['managed-task-categories', ''],
    queryFn: ({ signal }) => getManagedTaskCategories('', signal),
  });
  const project =
    data.content.project ??
    buildPublicProject(workItemTree, includedIds, requirement.title, data.summary, true);
  const publicContent = publicationContent(data, includedItems, project);
  const budgetLabel = rewardLabel(publicContent);
  const sourceLabel = publishSummary.isLoading ? '正在检查' : ({ success: 'AI 已生成', generating: 'AI 正在生成', failed: 'AI 生成失败', pending: '等待生成' }[publishSummary.status] || '等待生成');

  useEffect(() => {
    if (!publishSummary.content || summaryTouched.current) return;
    setData((current) => ({ ...current, summary: publishSummary.content }));
  }, [publishSummary.content]);

  useEffect(() => {
    formScrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    if (selected.length || includedItems.length || !workItemTree.length) return;
    setIncludedItems(
      flattenNodes(workItemTree).filter((item) => item.type === 'work' || item.type === 'subtask'),
    );
  }, [includedItems.length, selected.length, workItemTree]);

  useEffect(() => {
    const task = publishTask.data;
    if (!task || restoredTaskNo.current === task) return;
    restoredTaskNo.current = task;
    summaryTouched.current = true;
    setData(publicationEditorState(task));
  }, [publishTask.data]);

  const notify = (message) => window.dispatchEvent(new CustomEvent('toast', { detail: message }));
  const taskPayload = (status) => ({
    status,
    title: data.title,
    category: data.category,
    summary: data.summary,
    skills: data.skills,
    experience: data.experience,
    recruitCount: Number(data.recruitCount) || 0,
    priceModel: data.content.unit === 'hour' ? '按时计费' : '固定价格',
    budget: data.budget,
    startDate: data.startDate || null,
    deadline: data.deadline || null,
    workMode: data.mode,
    recruitMode: data.recruit,
    visibility: '所有人可见',
    content: publicContent,
    invitedUserNos: [],
    version: data.version,
  });
  const saveDraft = async () => {
    try {
      await publishTask.save(taskPayload('draft'));
      notify(publishTask.data?.version ? '编辑草稿已保存，正式版本保持不变' : '发布草稿已保存');
    } catch (error) {
      notify(error instanceof Error ? error.message : '草稿保存失败，请稍后重试');
    }
  };
  const confirmPublish = async () => {
    if (!data.content.details?.scopeConfirmed) return notify('请先确认整份 AI 工作范围');
    if (!data.title.trim() || !data.summary.trim()) return notify('请填写任务标题和任务简介');
    try {
      await publishTask.save(taskPayload('published'));
      window.localStorage.removeItem(`kx.publish-draft.${requirement.id}`);
      onDone();
    } catch (error) {
      notify(error instanceof Error ? error.message : '任务发布失败，请稍后重试');
    }
  };

  const discardDraft = () =>
    modal.confirm({
      title: '放弃当前草稿？',
      content: data.version
        ? '已保存和未保存的编辑都将放弃，恢复为当前正式版本。已发布内容和历史版本不变。'
        : '已保存和未保存的发布草稿都将放弃，需求和内部工作项保持不变。',
      okText: '放弃草稿',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const restored = await publishTask.discard();
          window.localStorage.removeItem(`kx.publish-draft.${requirement.id}`);
          setStep(0);
          notify('草稿已放弃');
          if (restored) {
            summaryTouched.current = true;
            restoredTaskNo.current = restored;
            setData(publicationEditorState(restored));
          } else onBack();
        } catch (error) {
          notify(error instanceof Error ? error.message : '放弃草稿失败，请稍后重试');
          throw error;
        }
      },
    });

  return (
    <main className="page publish-page compact-publish-page">
      {modalHolder}
      <header className="topbar">
        <button className="back" onClick={onBack}>
          <Icon name="ArrowLeft" />
          需求管理
        </button>
        <span>/</span>
        <strong>创建发布任务</strong>
        <span className="spacer" />
        <button
          className="ghost"
          disabled={publishTask.isSaving || mediaUploading}
          onClick={discardDraft}
        >
          放弃草稿
        </button>
        <button
          className="ghost"
          disabled={publishTask.isSaving || mediaUploading}
          onClick={() => void saveDraft()}
        >
          {publishTask.isSaving ? '保存中...' : '保存草稿'}
        </button>
      </header>

      {publishTask.data?.version > 0 && <RecruitmentManagement taskNo={publishTask.data.taskNo} />}
      <div className="wizard-steps compact-steps">
        {steps.map((label, index) => (
          <button
            type="button"
            className={`${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}
            key={label}
            onClick={() => setStep(index)}
          >
            <b>{index < step ? <Icon name="Check" size={14} /> : index + 1}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="wizard-layout compact-wizard-layout">
        <section className="form-panel">
          <div className="publish-form-scroll" ref={formScrollRef}>
            <div className="form-heading">
              <small>
                步骤 {step + 1} / {steps.length}
              </small>
              <h1>{steps[step]}</h1>
              <p>
                {
                  [
                    '确认从需求带入的任务信息与工作范围。',
                    '补充承接者要求、预算和交付周期。',
                    '检查完整内容并设置任务发布方式。',
                  ][step]
                }
              </p>
            </div>

            {step === 0 && (
              <>
                <div className="source-notice">
                  <Icon name="FileCheck" />
                  <span>
                    <strong>已关联需求 {requirement.id}</strong>
                    <small>任务简介来源：{sourceLabel}</small>
                  </span>
                </div>
                <label>
                  任务标题 <em>必填</em>
                  <input
                    value={data.title}
                    onChange={(event) => set('title', event.target.value)}
                  />
                </label>
                <label>
                  任务分类
                  <TaskCategorySelect
                    onCreate={onManageCategories}
                    value={data.category}
                    onChange={(value) => set('category', value)}
                  />
                </label>
                <label>
                  任务简介 <em>必填</em>
                  <textarea
                    value={data.summary}
                    readOnly={publishSummary.status === 'generating'}
                    placeholder={
                      publishSummary.isLoading || publishSummary.status === 'generating'
                        ? '正在生成精简的任务简介...'
                        : '请输入任务简介'
                    }
                    onChange={(event) => {
                      summaryTouched.current = true;
                      set('summary', event.target.value);
                    }}
                  />
                  <span className={`publish-summary-ai-state ${publishSummary.status}`}>
                    {publishSummary.isLoading && '正在检查已有任务简介...'}
                    {!publishSummary.isLoading && publishSummary.status === 'generating' && (
                      <>
                        <Icon name="LoaderCircle" className="spin" size={13} />
                        AI 正在生成精简任务简介
                      </>
                    )}
                    {!publishSummary.isLoading && publishSummary.status === 'success' && (
                      <>
                        <Icon name="CircleCheck" size={13} />
                        已使用 AI 生成的任务简介，可继续修改
                      </>
                    )}
                    {publishSummary.status === 'failed' && (
                      <>
                        <span>{publishSummary.error?.message || '任务简介生成失败'}</span>
                        <button type="button" onClick={publishSummary.retry}>
                          重新生成
                        </button>
                      </>
                    )}
                  </span>
                </label>
                <ProjectPublicationFields
                  value={project}
                  onChange={(next) =>
                    setData((current) => ({
                      ...current,
                      content: {
                        ...current.content,
                        project: next,
                        details: {
                          ...(current.content.details || emptyTaskContent().details),
                          scopeConfirmed: false,
                        },
                      },
                    }))
                  }
                  onRefresh={() =>
                    setData((current) => ({
                      ...current,
                      content: {
                        ...current.content,
                        details: {
                          ...(current.content.details || emptyTaskContent().details),
                          scopeConfirmed: false,
                        },
                        project: buildPublicProject(
                          workItemTree,
                          includedIds,
                          project.title,
                          project.summary,
                          true,
                        ),
                      },
                    }))
                  }
                />
                <Checkbox
                  checked={data.content.details?.scopeConfirmed ?? false}
                  onChange={(e) =>
                    setData((current) => ({
                      ...current,
                      content: {
                        ...current.content,
                        details: {
                          ...(current.content.details || emptyTaskContent().details),
                          scopeConfirmed: e.target.checked,
                        },
                      },
                    }))
                  }
                >
                  已逐项确认整份 AI 拆解，发布范围中的全部工作均需实现
                </Checkbox>
              </>
            )}

            {step === 1 && (
              <>
                <TaskContentFields
                  value={data.content}
                  onChange={(patch) =>
                    setData((current) => ({
                      ...current,
                      content: { ...current.content, ...patch },
                    }))
                  }
                  workMode={data.mode}
                  onUploadingChange={setMediaUploading}
                />
                <label>
                  角色与技能要求
                  <input
                    value={data.skills}
                    onChange={(event) => set('skills', event.target.value)}
                    placeholder="例如：产品设计、前端开发"
                  />
                  <small>
                    {initialRoles
                      ? '已根据工作项角色自动汇总，可继续修改'
                      : '需求中未提供角色，请手动填写'}
                  </small>
                </label>
                <div className="form-grid">
                  <label>
                    经验等级
                    <Select
                      className="publish-select"
                      value={data.experience}
                      options={options(['不限', '熟练', '资深'])}
                      onChange={(value) => set('experience', value)}
                    />
                  </label>
                  <label>
                    招募人数
                    <input
                      type="number"
                      min="1"
                      value={data.recruitCount}
                      onChange={(event) => set('recruitCount', event.target.value)}
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    回报补充说明（选填）
                    <input
                      value={data.budget}
                      onChange={(event) => set('budget', event.target.value)}
                      placeholder="补充双方需要了解的回报约定"
                    />
                  </label>
                  <label>
                    工作方式
                    <Select
                      className="publish-select"
                      value={data.mode}
                      options={options(['远程', '现场', '混合'])}
                      onChange={(value) => set('mode', value)}
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    开始时间
                    <DatePicker
                      className="publish-date-picker"
                      value={data.startDate ? dayjs(data.startDate) : null}
                      format="YYYY/MM/DD"
                      inputReadOnly
                      onChange={(value) => set('startDate', value?.format('YYYY-MM-DD') || '')}
                    />
                    <small>
                      {initialStartDates.length
                        ? '已取工作项中的最早开始时间'
                        : '工作项中未设置开始时间'}
                    </small>
                  </label>
                  <label>
                    结束时间
                    <DatePicker
                      className="publish-date-picker"
                      value={data.deadline ? dayjs(data.deadline) : null}
                      format="YYYY/MM/DD"
                      inputReadOnly
                      onChange={(value) => set('deadline', value?.format('YYYY-MM-DD') || '')}
                    />
                    <small>
                      {initialEndDates.length
                        ? '已取工作项中的最晚结束时间'
                        : '工作项中未设置结束时间'}
                    </small>
                  </label>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="form-grid">
                  <label>
                    招募方式
                    <Select
                      className="publish-select"
                      value={data.recruit}
                      options={options(['报名审核', '直接领取', '竞标'])}
                      onChange={(value) => set('recruit', value)}
                    />
                  </label>
                  <div className="publish-visibility">
                    <span>可见范围</span>
                    <strong>所有人可见</strong>
                    <small>正式发布后即可在 C 端查看。</small>
                  </div>
                </div>
                <div className="publish-review-list">
                  <div>
                    <span>来源需求</span>
                    <strong>{requirement.title}</strong>
                  </div>
                  <div>
                    <span>工作范围</span>
                    <strong>
                      {publicContent.scope.length
                        ? `${publicContent.scope.length} 项工作范围`
                        : '未填写'}
                    </strong>
                  </div>
                  <div>
                    <span>承接要求</span>
                    <strong>{data.skills || '待补充'}</strong>
                  </div>
                  <div>
                    <span>预算与周期</span>
                    <strong>
                      {budgetLabel} · {data.deadline || '日期待补充'}
                    </strong>
                  </div>
                </div>
                <div className="publish-review-list">
                  <div>
                    <span>所属项目</span>
                    <strong>{project.title || data.title}</strong>
                  </div>
                  <div>
                    <span>项目任务</span>
                    <strong>{countProjectTasks(project.tasks)} 个可执行项</strong>
                  </div>
                </div>
                <div className="publish-check">
                  <Icon name="ShieldCheck" />
                  <div>
                    <strong>请完成最终确认</strong>
                    <p>发布后，项目介绍、项目任务和当前预览内容将对所有人可见。</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <footer>
            <div className="publish-step-context">
              <small>
                步骤 {step + 1} / {steps.length}
              </small>
              <strong>
                {steps[step]}
                {step < steps.length - 1 && <span>下一步：{steps[step + 1]}</span>}
              </strong>
            </div>
            <div className="publish-footer-actions">
              {step > 0 && (
                <button onClick={() => setStep((current) => current - 1)}>上一步</button>
              )}
              <button
                className="primary"
                disabled={
                  publishTask.isSaving ||
                  mediaUploading ||
                  !data.title.trim() ||
                  !data.summary.trim()
                }
                onClick={() =>
                  step < 2 ? setStep((current) => current + 1) : void confirmPublish()
                }
              >
                {step < 2 ? '下一步' : publishTask.isSaving ? '发布中...' : '确认发布'}
                <Icon name={step < 2 ? 'ArrowRight' : 'Send'} />
              </button>
            </div>
          </footer>
        </section>

        <aside className="preview publish-preview">
          <header>
            <button className="ghost" onClick={() => setFullPreview(true)}>
              打开完整详情预览
            </button>
            <b>{requirement.id}</b>
          </header>
          <PublicTaskPreview
            content={publicContent}
            categoryName={
              categoryQuery.data?.find((c) => c.code === data.category)?.name || data.category
            }
            recruitCount={Number(data.recruitCount) || 0}
            experience={data.experience}
          />
        </aside>
      </div>
      <Modal
        title="完整任务详情预览"
        open={fullPreview}
        onCancel={() => setFullPreview(false)}
        width={1120}
        footer={null}
      >
        <PublicTaskPreview
          content={publicContent}
          categoryName={
            categoryQuery.data?.find((c) => c.code === data.category)?.name || data.category
          }
          recruitCount={Number(data.recruitCount) || 0}
          experience={data.experience}
        />
      </Modal>
      {publishTask.data && (
        <PublicationHistory
          requirementNo={requirement.id}
          version={publishTask.data.version || 0}
          hasDraft={publishTask.data.hasDraft || false}
        />
      )}
    </main>
  );
}
