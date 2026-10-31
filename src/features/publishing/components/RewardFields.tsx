import { Alert, Button, Checkbox, Input, Tag } from 'antd';
import { Banknote, Gift, Handshake, ImagePlus, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PublicContent, RewardItem } from '../api/taskContentApi';
import { useRewardAnalysis } from '../hooks/useRewardAnalysis';
import { RewardItemEditor } from './RewardItemEditor';
import { rewardItemTitle } from './rewardPresentation';

const labels = { cash: '现金回报', goods: '物品回报', service: '服务回报' };
const icons = { cash: Banknote, goods: Gift, service: Handshake };
export function RewardFields({
  value,
  onChange,
  requirementNo,
}: {
  value: PublicContent;
  onChange: (v: Partial<PublicContent>) => void;
  requirementNo: string;
}) {
  const detail = value.details;
  const items = detail?.rewards ?? [];
  const incomingDescription = detail?.rewardDescription ?? '';
  const [draft, setDraft] = useState({ base: incomingDescription, text: incomingDescription });
  const description = draft.base === incomingDescription ? draft.text : incomingDescription;
  const setDescription = (text: string) => setDraft({ base: incomingDescription, text });
  const [editing, setEditing] = useState<number | null>(null);
  const [localError, setLocalError] = useState('');
  const applied = useRef<string | null>(null);
  const source = useRef(description);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    source.current = description;
    latest.current = { value, onChange };
  }, [description, value, onChange]);
  const analysis = useRewardAnalysis(requirementNo, detail?.rewardAnalysisId);
  const job = analysis.query.data;
  const result = job?.status === 'SUCCESS' ? job.result : null;
  const edited = Boolean(
    result &&
    detail?.rewardAppliedId === job?.taskId &&
    JSON.stringify(items) !== JSON.stringify(result.rewards),
  );
  const stale = description !== (job?.description ?? detail?.rewardDescription ?? '');
  // 查询结果仅在对应原文仍未改变时写入可编辑草稿；迟到响应不能覆盖新输入。
  useEffect(() => {
    if (
      !job ||
      job.status !== 'SUCCESS' ||
      !job.result ||
      applied.current === job.taskId ||
      job.description !== source.current
    )
      return;
    applied.current = job.taskId;
    const { value: current, onChange: change } = latest.current;
    if (current.details?.rewardAppliedId === job.taskId || current.details?.rewardConfirmed) return;
    const rewards = job.result.rewards;
    change({
      rewardType: rewards.length === 1 ? rewards[0].type : 'mixed',
      amountMin: null,
      amountMax: null,
      details: {
        ...current.details,
        collaboration: current.details?.collaboration ?? '',
        rewards,
        rewardDescription: job.description,
        rewardAnalysisId: job.taskId,
        rewardAppliedId: job.taskId,
        rewardConfirmed: false,
      },
    });
  }, [job]);
  const update = (rewards: RewardItem[]) => {
    setEditing(null);
    onChange({
      rewardType: rewards.length === 1 ? rewards[0].type : 'mixed',
      amountMin: null,
      amountMax: null,
      details: {
        ...detail,
        collaboration: detail?.collaboration ?? '',
        rewards,
        rewardConfirmed: false,
      },
    });
  };
  const start = async (review = false) => {
    setLocalError('');
    setEditing(null);
    const submitted = description.trim();
    if (!submitted) {
      setLocalError('请先描述你能提供的回报。');
      return;
    }
    try {
      const next = await analysis.submit.mutateAsync({
        description: submitted,
        ...(review ? { rewards: items } : {}),
      });
      if (source.current.trim() !== submitted) return;
      setDescription(submitted);
      applied.current = null;
      const { value: current, onChange: change } = latest.current;
      change({
        details: {
          ...current.details,
          collaboration: current.details?.collaboration ?? '',
          rewards: current.details?.rewards ?? [],
          rewardDescription: submitted,
          rewardAnalysisId: next.taskId,
          rewardConfirmed: false,
        },
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '回报整理失败，请重试。');
    }
  };
  const canConfirm = Boolean(
    result &&
    result.reviewStatus === 'allowed' &&
    !result.missingInformation.length &&
    items.length &&
    !stale &&
    !edited &&
    !analysis.busy &&
    editing === null,
  );
  return (
    <section className="reward-fields reward-ai-fields">
      <p className="reward-input-hint">支持现金、物品或服务，也可以组合提供，由 AI 自动整理。</p>
      <div className="reward-description-box">
        <Input.TextArea
          aria-label="回报描述"
          value={description}
          maxLength={5000}
          autoSize={{ minRows: 4, maxRows: 9 }}
          placeholder="例如：提供现金 1000～2000 元，验收后支付；另送 1 张年度会员卡，并提供 1 次、每次 1 小时的摄影指导。"
          onChange={(e) => {
            source.current = e.target.value;
            setDescription(e.target.value);
            setLocalError('');
            if (detail?.rewardConfirmed)
              onChange({ details: { ...detail, rewardConfirmed: false } });
          }}
          onBlur={() => {
            if (description !== detail?.rewardDescription)
              onChange({
                details: {
                  ...detail,
                  collaboration: detail?.collaboration ?? '',
                  rewards: items,
                  rewardDescription: description,
                  rewardConfirmed: false,
                },
              });
          }}
        />
        <div className="reward-description-footer">
          <span>直接描述金额、数量及兑现约定</span>
          <Button
            type="primary"
            icon={<Sparkles size={14} />}
            loading={analysis.busy}
            disabled={!description.trim()}
            onClick={() => void start()}
          >
            {items.length ? '重新整理' : 'AI 整理回报'}
          </Button>
        </div>
      </div>
      <div className="reward-images-heading">
        回报图片 <span>（选填）· 物品实拍、服务案例等</span>
      </div>
      <Button disabled className="reward-image-placeholder" aria-label="回报图片上传暂未开放">
        <ImagePlus size={20} />
        <span>上传图片</span>
        <small>后续开放</small>
      </Button>
      <div className="reward-policy">
        请确保回报真实、合法且可兑现，图片与描述一致。
        <details>
          <summary>查看内容规范</summary>
          <p>
            不得发布违法违禁物品或服务、色情赌博、欺诈引流及侵犯他人权益的内容；不得作出虚假或无法兑现的承诺。涉及资质或授权的，请确保具备相应证明。AI
            仅辅助识别风险，不代表已通过全部合规审核。
          </p>
        </details>
      </div>
      {(localError || analysis.query.error) && (
        <Alert
          type="error"
          showIcon
          title={localError || analysis.query.error?.message}
          action={
            analysis.query.error ? (
              <Button size="small" onClick={() => void analysis.query.refetch()}>
                重试查询
              </Button>
            ) : undefined
          }
        />
      )}
      {job?.status === 'FAILED' && (
        <Alert
          type="error"
          showIcon
          title="回报整理失败，请重试；现有条目仍保留。"
          action={
            <Button size="small" onClick={() => void start(edited)}>
              重试
            </Button>
          }
        />
      )}
      {analysis.busy && <Alert type="info" showIcon title="AI 正在整理与检查回报内容，请稍候…" />}
      {items.length > 0 && (
        <>
          <div className="reward-results-heading">
            <strong>AI 整理结果</strong>
            <Tag color="blue">{items.length} 项 · 请核对</Tag>
          </div>
          {(stale || edited) && (
            <Alert
              type="warning"
              showIcon
              title={stale ? '回报描述已变化，请重新整理。' : '条目已修改，请复核后确认。'}
              action={
                !stale && edited ? (
                  <Button size="small" onClick={() => void start(true)} loading={analysis.busy}>
                    复核修改
                  </Button>
                ) : undefined
              }
            />
          )}
          <div className="reward-results">
            {items.map((r, i) => {
              const Icon = icons[r.type];
              return (
                <div className="reward-result-row" key={`${i}-${r.type}`}>
                  <span className="reward-result-icon">
                    <Icon size={17} />
                  </span>
                  <div className="reward-result-content">
                    <small>{labels[r.type]}</small>
                    <strong>{rewardItemTitle(r)}</strong>
                    {[r.condition, r.description, r.handover].filter(Boolean).map((s, n) => (
                      <p key={n}>{s}</p>
                    ))}
                  </div>
                  <Button
                    type="link"
                    size="small"
                    disabled={analysis.busy}
                    onClick={() => setEditing(editing === i ? null : i)}
                  >
                    编辑
                  </Button>
                  {editing === i && (
                    <RewardItemEditor
                      value={r}
                      onCancel={() => setEditing(null)}
                      onSave={(next) => update(items.map((item, n) => (n === i ? next : item)))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {result && !stale && !edited && (
        <>
          {result.reviewStatus !== 'allowed' && (
            <Alert
              type={result.reviewStatus === 'blocked' ? 'error' : 'warning'}
              showIcon
              title={
                result.reviewStatus === 'blocked' ? '回报内容需修改后才能继续' : '请确认回报条件'
              }
              description={result.reviewMessage}
            />
          )}
          {result.missingInformation.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title="请补充以下信息后重新整理"
              description={
                <ul>
                  {result.missingInformation.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              }
            />
          )}
          {!items.length && <Alert type="warning" title="尚未识别到有效回报，请补充描述后重试。" />}
        </>
      )}
      {items.length > 0 && (
        <Checkbox
          checked={Boolean(detail?.rewardConfirmed)}
          disabled={!canConfirm}
          onChange={(e) =>
            onChange({
              details: {
                ...detail,
                collaboration: detail?.collaboration ?? '',
                rewards: items,
                rewardConfirmed: e.target.checked,
              },
            })
          }
        >
          我已核对回报内容，确认真实、可提供并按约定履行。
        </Checkbox>
      )}
      <p className="reward-disclaimer">平台仅展示回报信息，不提供支付、物流或履约担保。</p>
    </section>
  );
}
