import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons';
import AnalysisPreview from './AnalysisPreview';
import { PlanningWorkspace } from './Planning';
import { useDecompositionTask } from '../features/decomposition/hooks/useDecompositionTask';

const initialDescription = `我们需要开发一套面向用户的预约服务系统，支持用户选择服务项目、门店、日期和时间创建订单。

系统需要覆盖用户注册、预约、订单管理，以及取消、改期和退款等能力。`;

const mergePromptTemplate = `# 角色定位

你是一位具有丰富经验的高级产品经理，擅长需求梳理、需求收敛、功能拆解及技术风险识别。

# 任务目标

请根据当前对话中的全部需求讨论记录，整理出截至目前最新、最终有效的产品功能需求清单。

注意：本次任务不是重新进行需求分析，也不是扩展新功能，而是对多轮修改后的需求进行最终收敛。

# 一、需求收敛规则

1. 以最新要求为准：同一功能在多轮对话中出现不同描述时，以用户最后一次明确提出的要求为准。
2. 保留有效需求：保留最初提出且后续未被修改、删除或否定的功能。
3. 排除废弃需求：明确删除、不需要、取消或被新方案替代的功能，不得出现在最终功能清单中。
4. 合并重复功能：同一功能在多轮讨论中使用不同名称或描述时，应合并为一个功能点。
5. 区分确认与建议：用户明确要求的功能可以列为必需；AI 自行提出、但用户未确认的增强功能，只能列为可选，并标记为待确认。
6. 不擅自扩展需求：不得添加对话中没有提出或讨论过的新功能。
7. 处理需求冲突：如果存在无法判断最终结果的冲突，应标记为待确认，不得自行决定。
8. 保留需求边界：不得因为总结或简化而丢失功能的关键约束条件。

# 二、输出内容

1. 核心功能点列表，每个功能用一句话描述。
2. 按重要性分组：必需、可选。
3. 标注可能的技术风险点。

# 三、输出质量要求

1. 最终功能清单不得包含已删除或被替代的需求。
2. 同一功能不得重复出现。
3. 不得遗漏仍然有效的原始需求。
4. 功能描述应保持独立、完整、无歧义。
5. 不要输出分析过程或需求收敛说明，只输出最终结果。
6. 使用 Markdown 表格，方便复制、保存及后续处理。

现在请根据完整对话历史，生成最终有效的功能需求清单。`;

export default function AnalysisWorkbench({
  requirement,
  modules,
  setModules,
  onRequirementChange,
  onBack,
  onPublish,
  isPublishing,
}) {
  const initialAiDescription = '';
  const [title, setTitle] = useState(requirement.title);
  const [description, setDescription] = useState(requirement.description || initialDescription);
  const [descriptionMode, setDescriptionMode] = useState('user');
  const [aiMode, setAiMode] = useState(() => (initialAiDescription.trim() ? 'preview' : 'edit'));
  const [aiDescription, setAiDescription] = useState(
    requirement.aiDescription || initialAiDescription,
  );
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [mergePromptOpen, setMergePromptOpen] = useState(false);
  const [mergePromptText, setMergePromptText] = useState(mergePromptTemplate);
  const [rightView, setRightView] = useState('ai');
  const deferredTitle = useDeferredValue(title);
  const iframeRef = useRef();
  const appliedTaskRef = useRef();
  const decompositionTask = useDecompositionTask(requirement.currentDecompositionNo);
  const decomposition = useMemo(
    () =>
      decompositionTask.error
        ? {
            status: 'FAILED',
            stage: 'FAILED',
            message: decompositionTask.error.message || '拆解任务失败',
          }
        : decompositionTask.isPending && !decompositionTask.task
          ? { status: 'SUBMITTING', stage: 'SUBMITTING', message: '正在提交拆解任务' }
          : decompositionTask.task,
    [decompositionTask.error, decompositionTask.isPending, decompositionTask.task],
  );
  const prompt = useMemo(
    () => `你是一位有经验的产品经理，请帮我分析以下需求：

需求标题：${title || '未填写'}
需求描述：${description || '未填写'}

请按以下格式输出：
核心功能点列表（每个功能用一句话描述）
按重要性分组（必需/可选）
标注可能的技术风险点`,
    [title, description],
  );
  const notify = (message) => window.dispatchEvent(new CustomEvent('toast', { detail: message }));
  const copyText = async (text, message) => {
    await navigator.clipboard.writeText(text);
    notify(message);
  };
  const openPrompt = () => {
    setPromptText(prompt);
    setPromptOpen(true);
  };
  const showAiDescription = () => {
    setDescriptionMode('ai');
    setAiMode(aiDescription.trim() ? 'preview' : 'edit');
  };
  const startDecomposition = async () => {
    setRightView('planning');
    if (!aiDescription.trim()) {
      showAiDescription();
      notify('请先填写 AI 需求描述');
      return;
    }
    try {
      await decompositionTask.start(aiDescription.trim());
    } catch {
      // Error presentation is centralized in useDecompositionTask.
    }
  };
  useEffect(() => {
    if (decomposition?.status !== 'SUCCESS' || appliedTaskRef.current === decomposition.taskId)
      return;
    appliedTaskRef.current = decomposition.taskId;
    setModules(decomposition.modules || []);
    onRequirementChange?.({ currentDecompositionNo: decomposition.taskId });
    notify(
      `拆解完成：${decomposition.summary?.moduleCount || 0} 个模块，${decomposition.summary?.workItemCount || 0} 个工作项`,
    );
  }, [decomposition, onRequirementChange, setModules]);

  return (
    <main className="workbench">
      <header className="topbar workbench-top">
        <button className="back" onClick={onBack}>
          <Icon name="ArrowLeft" />
          需求分析
        </button>
        <span>/</span>
        <strong>{title || '未命名需求标题'}</strong>
        <span className="spacer" />
        <button
          className="ghost"
          disabled={
            decomposition && ['SUBMITTING', 'QUEUED', 'PROCESSING'].includes(decomposition.status)
          }
          onClick={startDecomposition}
        >
          <Icon
            name={
              decomposition && ['SUBMITTING', 'QUEUED', 'PROCESSING'].includes(decomposition.status)
                ? 'LoaderCircle'
                : 'ListTree'
            }
            className={
              decomposition && ['SUBMITTING', 'QUEUED', 'PROCESSING'].includes(decomposition.status)
                ? 'spin'
                : ''
            }
          />
          {decomposition && ['SUBMITTING', 'QUEUED', 'PROCESSING'].includes(decomposition.status)
            ? '正在拆解'
            : '拆解工作项'}
        </button>
        <button
          className="primary"
          disabled={isPublishing}
          onClick={() =>
            onPublish([], {
              title,
              description,
              aiDescription,
              currentDecompositionNo:
                decomposition?.status === 'SUCCESS' ? decomposition.taskId : requirement.currentDecompositionNo,
            })
          }
        >
          <Icon name={isPublishing ? 'LoaderCircle' : 'Send'} className={isPublishing ? 'spin' : ''} />
          {isPublishing ? '正在保存' : '任务发布'}
        </button>
      </header>
      <div className="step-strip">
        {[
          ['1', '原始需求'],
          ['2', 'AI 辅助分析'],
          ['3', '确认分析结果'],
          ['4', '拆解工作项'],
          ['5', '任务发布'],
        ].map((step, index) => (
          <div
            className={
              index < (rightView === 'planning' ? 4 : aiDescription.trim() ? 3 : 2) ? 'current' : ''
            }
            key={step[0]}
          >
            <b>{step[0]}</b>
            <span>
              <strong>{step[1]}</strong>
              <small>
                {
                  [
                    '标题、描述与附件',
                    '内嵌豆包协作',
                    '结构化功能项',
                    '模块、任务与依赖',
                    '完善信息并发布',
                  ][index]
                }
              </small>
            </span>
            {index < 4 && <Icon name="ChevronRight" />}
          </div>
        ))}
      </div>
      <div className="analysis-panels">
        <section className="panel source-panel">
          <div className="panel-title">
            <span>
              <b>1</b>
              <strong>原始需求</strong>
            </span>
          </div>
          <div className="requirement-form">
            <label className="requirement-field title-field">
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  startTransition(() => onRequirementChange?.({ title: event.target.value }));
                }}
                placeholder="用一句话概括需求"
                aria-label="需求标题"
              />
            </label>
            <div className="requirement-field description-field">
              <div className="description-heading">
                <span>需求描述</span>
                <div className="description-switch">
                  <button
                    className={descriptionMode === 'user' ? 'active' : ''}
                    onClick={() => setDescriptionMode('user')}
                  >
                    <Icon name="UserRound" size={13} />
                    用户填写
                  </button>
                  <button
                    className={descriptionMode === 'ai' ? 'active' : ''}
                    onClick={showAiDescription}
                  >
                    <Icon name="Sparkles" size={13} />
                    AI 需求描述
                  </button>
                </div>
              </div>
              {descriptionMode === 'user' ? (
                <div className="rich-editor-shell">
                  <div className="rich-toolbar">
                    {[
                      'Bold',
                      'Italic',
                      'Underline',
                      'Link',
                      'List',
                      'ListOrdered',
                      'Paperclip',
                      'Image',
                    ].map((name) => (
                      <button type="button" key={name}>
                        <Icon name={name} size={15} />
                      </button>
                    ))}
                    <i />
                    <button type="button" onClick={() => copyText(description, '需求描述已复制')}>
                      <Icon name="Copy" size={15} />
                      复制描述
                    </button>
                  </div>
                  <textarea
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      startTransition(() =>
                        onRequirementChange?.({ description: event.target.value }),
                      );
                    }}
                    placeholder="描述需求背景、目标、使用场景和约束条件…"
                  />
                </div>
              ) : (
                <div className="ai-description-shell">
                  <div className="ai-description-toolbar">
                    <div>
                      <span className="ai-state">
                        <Icon name="Sparkles" size={13} />
                        豆包分析结果
                      </span>
                      <small>编辑内容仅保留在当前页面，不覆盖用户原始描述</small>
                    </div>
                    <span />
                    <button
                      className={aiMode === 'edit' ? 'active' : ''}
                      onClick={() => setAiMode('edit')}
                    >
                      <Icon name="Pencil" size={14} />
                      编辑原文
                    </button>
                    <button
                      className={aiMode === 'preview' ? 'active' : ''}
                      disabled={!aiDescription.trim()}
                      onClick={() => setAiMode('preview')}
                    >
                      <Icon name="Eye" size={14} />
                      评审预览
                    </button>
                  </div>
                  {aiMode === 'preview' ? (
                    <AnalysisPreview content={aiDescription} />
                  ) : (
                    <textarea
                      className="ai-description-editor"
                      value={aiDescription}
                      onChange={(event) => {
                        setAiDescription(event.target.value);
                        startTransition(() =>
                          onRequirementChange?.({ aiDescription: event.target.value }),
                        );
                      }}
                      placeholder="将豆包生成的分析内容粘贴到这里…"
                    />
                  )}
                </div>
              )}
            </div>
            <div className="attachments">
              <div>
                <Icon name="Image" />
                <span>
                  门店示意图.png<small>1.8 MB</small>
                </span>
                <button>
                  <Icon name="X" size={13} />
                </button>
              </div>
              <div>
                <Icon name="FileText" />
                <span>
                  需求说明.docx<small>246 KB</small>
                </span>
                <button>
                  <Icon name="X" size={13} />
                </button>
              </div>
              <button className="upload">
                <Icon name="Plus" />
                添加附件
              </button>
            </div>
          </div>
          <div className="prompt-action">
            <div>
              <Icon name="WandSparkles" />
              <span>
                <strong>准备交给 AI 分析</strong>
                <small>生成标准提示词后，可直接发送给豆包</small>
              </span>
            </div>
            <span
              className="tooltip-wrap"
              data-tooltip="根据当前需求标题和描述生成结构化提示词，复制后可直接发送给豆包进行功能拆解。"
            >
              <button className="primary" onClick={openPrompt}>
                <Icon name="MessageSquareText" />
                生成需求拆解提示词
              </button>
            </span>
          </div>
        </section>
        <section className="panel ai-panel">
          <div className="right-workspace-tabs">
            <button
              className={rightView === 'ai' ? 'active' : ''}
              onClick={() => setRightView('ai')}
            >
              <Icon name="Sparkles" />
              AI 分析
            </button>
            <button
              className={rightView === 'planning' ? 'active' : ''}
              onClick={() => setRightView('planning')}
            >
              <Icon name="ListTree" />
              工作项拆解
            </button>
          </div>
          <div
            className={`right-workspace-pane ai-workspace ${rightView === 'ai' ? 'active' : ''}`}
            aria-hidden={rightView !== 'ai'}
          >
            <div className="panel-title">
              <span>
                <b>2</b>
                <strong>AI 辅助分析</strong>
              </span>
              <div>
                <button
                  className="icon-btn"
                  title="刷新豆包"
                  onClick={() => {
                    if (iframeRef.current)
                      iframeRef.current.src = `https://www.doubao.com/chat/?refresh=${Date.now()}`;
                  }}
                >
                  <Icon name="RefreshCw" />
                </button>
                <a
                  className="icon-btn"
                  title="新窗口打开"
                  href="https://www.doubao.com/chat/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="ExternalLink" />
                </a>
              </div>
            </div>
            <div className="iframe-bar">
              <span className="doubao-dot">豆</span>
              <strong>豆包</strong>
              <span>已内嵌</span>
              <button className="merge-prompt-button" onClick={() => setMergePromptOpen(true)}>
                <Icon name="Combine" size={13} />
                复制合并提示词
              </button>
              <a href="https://www.doubao.com/chat/" target="_blank" rel="noreferrer">
                新窗口打开
              </a>
            </div>
            <iframe
              ref={iframeRef}
              title="豆包 AI"
              src="https://www.doubao.com/chat/"
              allow="clipboard-read; clipboard-write; microphone"
              referrerPolicy="no-referrer"
            />
          </div>
          {rightView === 'planning' && <div
            className="right-workspace-pane planning-pane active"
          >
            <PlanningWorkspace
              embedded
              title={deferredTitle}
              modules={modules}
              setModules={setModules}
              decompositionNo={requirement.currentDecompositionNo}
              emptyPrimaryLabel="拆解工作项"
              onEmptyPrimary={startDecomposition}
            />
            {decomposition && decomposition.status !== 'SUCCESS' && (
              <div
                className={`decomposition-status ${decomposition.status === 'FAILED' ? 'failed' : ''}`}
              >
                <div className="decomposition-status-card">
                  <span className="decomposition-status-icon">
                    <Icon
                      name={decomposition.status === 'FAILED' ? 'CircleAlert' : 'Sparkles'}
                      size={20}
                    />
                  </span>
                  <h3>
                    {decomposition.status === 'FAILED' ? '工作项拆解未完成' : '正在拆解工作项'}
                  </h3>
                  <p>{decomposition.message}</p>
                  {decomposition.status !== 'FAILED' && (
                    <>
                      <div className="tree-skeleton">
                        {[72, 88, 62, 80].map((width, index) => (
                          <span
                            key={width}
                            style={{ width: `${width}%`, marginLeft: `${index % 2 ? 22 : 0}px` }}
                          />
                        ))}
                      </div>
                      <small>完成后将自动展示工作项树，请勿重复提交。</small>
                    </>
                  )}
                  {decomposition.status === 'FAILED' && (
                    <button className="primary" onClick={startDecomposition}>
                      <Icon name="RotateCcw" size={14} />
                      重新尝试
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>}
        </section>
      </div>
      {promptOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setPromptOpen(false)}
        >
          <section
            className="prompt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="modal-icon">
                  <Icon name="WandSparkles" />
                </span>
                <div>
                  <h2 id="prompt-title">需求拆解提示词</h2>
                  <p>已带入当前需求标题和描述，发送前可继续补充或调整。</p>
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label="关闭弹窗"
                onClick={() => setPromptOpen(false)}
              >
                <Icon name="X" />
              </button>
            </header>
            <textarea
              className="prompt-editor"
              aria-label="需求拆解提示词"
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
            />
            <footer>
              <button onClick={() => setPromptOpen(false)}>取消</button>
              <button
                className="primary"
                onClick={() => copyText(promptText, '提示词已复制，可以粘贴到豆包')}
              >
                <Icon name="Copy" />
                复制并用于豆包分析
              </button>
            </footer>
          </section>
        </div>
      )}
      {mergePromptOpen && (
        <div
          className="modal-backdrop merge-backdrop"
          role="presentation"
          onMouseDown={() => setMergePromptOpen(false)}
        >
          <section
            className="prompt-modal merge-prompt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-prompt-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="modal-icon">
                  <Icon name="Combine" />
                </span>
                <div>
                  <h2 id="merge-prompt-title">需求合并提示词</h2>
                  <p>用于让豆包根据完整对话历史，收敛出最终有效的需求清单。</p>
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label="关闭弹窗"
                onClick={() => setMergePromptOpen(false)}
              >
                <Icon name="X" />
              </button>
            </header>
            <textarea
              className="prompt-editor merge-prompt-editor"
              aria-label="需求合并提示词"
              value={mergePromptText}
              onChange={(event) => setMergePromptText(event.target.value)}
            />
            <footer className="merge-prompt-footer">
              <div className="result-guidance">
                <span className="guidance-icon">
                  <Icon name="ClipboardPaste" size={15} />
                </span>
                <span>
                  生成最终功能列表后，将完整结果粘贴至左侧{' '}
                  <strong>「需求描述 - AI 需求描述」</strong> 中
                </span>
              </div>
              <button onClick={() => setMergePromptOpen(false)}>取消</button>
              <button
                className="primary"
                onClick={() => copyText(mergePromptText, '合并提示词已复制，可以粘贴到豆包')}
              >
                <Icon name="Copy" />
                复制并发送给豆包
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
