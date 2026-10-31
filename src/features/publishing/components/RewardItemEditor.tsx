import { Button, Input, InputNumber, Select } from 'antd';
import { useState } from 'react';
import type { RewardItem } from '../api/taskContentApi';

const types = [
  { value: 'cash', label: '现金回报' },
  { value: 'goods', label: '物品回报' },
  { value: 'service', label: '服务回报' },
];
/** 只有展开编辑时才展示详细字段，避免默认呈现多张表单。 */
export function RewardItemEditor({
  value,
  onSave,
  onCancel,
}: {
  value: RewardItem;
  onSave: (value: RewardItem) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const patch = (v: Partial<RewardItem>) => setDraft((current) => ({ ...current, ...v }));
  return (
    <div className="reward-item-editor">
      <div className="form-grid">
        <label>
          回报类型
          <Select
            aria-label="条目回报类型"
            value={draft.type}
            options={types}
            onChange={(type) =>
              patch({
                type,
                pricing: type === 'cash' ? 'fixed' : null,
                amountMin: null,
                amountMax: null,
                quantity: null,
                unit: type === 'cash' ? '项目' : null,
                condition: null,
              })
            }
          />
        </label>
        <label>
          名称
          <Input
            aria-label="回报名称"
            value={draft.title}
            maxLength={255}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
      </div>
      {draft.type === 'cash' ? (
        <>
          <div className="form-grid">
            <label>
              报价形式
              <Select
                aria-label="报价形式"
                value={draft.pricing}
                options={[
                  { value: 'fixed', label: '固定金额' },
                  { value: 'range', label: '金额区间' },
                ]}
                onChange={(pricing) =>
                  patch({
                    pricing,
                    amountMax: pricing === 'fixed' ? draft.amountMin : draft.amountMax,
                  })
                }
              />
            </label>
            <label>
              计价单位
              <Select
                aria-label="计价单位"
                value={draft.unit}
                options={['项目', '小时', '天', '次', '件'].map((v) => ({ value: v, label: v }))}
                onChange={(unit) => patch({ unit })}
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              {draft.pricing === 'range' ? '金额下限 ¥' : '金额 ¥'}
              <InputNumber
                aria-label="金额下限"
                min={0.01}
                precision={2}
                value={draft.amountMin}
                onChange={(v) =>
                  patch({ amountMin: v, ...(draft.pricing === 'fixed' ? { amountMax: v } : {}) })
                }
              />
            </label>
            {draft.pricing === 'range' && (
              <label>
                金额上限 ¥
                <InputNumber
                  aria-label="金额上限"
                  min={0.01}
                  precision={2}
                  value={draft.amountMax}
                  onChange={(amountMax) => patch({ amountMax })}
                />
              </label>
            )}
          </div>
        </>
      ) : (
        <div className="form-grid">
          <label>
            {draft.type === 'goods' ? '数量' : '次数／数量（选填）'}
            <InputNumber
              aria-label="回报数量"
              min={0.01}
              precision={2}
              value={draft.quantity}
              onChange={(quantity) => patch({ quantity })}
            />
          </label>
          <label>
            数量单位
            <Input
              aria-label="数量单位"
              value={draft.unit ?? ''}
              maxLength={32}
              onChange={(e) => patch({ unit: e.target.value })}
            />
          </label>
        </div>
      )}
      {draft.type === 'goods' && (
        <label>
          成色／使用情况（选填）
          <Input
            value={draft.condition ?? ''}
            maxLength={500}
            onChange={(e) => patch({ condition: e.target.value })}
          />
        </label>
      )}
      <label>
        {draft.type === 'cash'
          ? '补充说明（选填）'
          : draft.type === 'goods'
            ? '物品规格与包含内容'
            : '服务范围、次数与时长'}
        <Input.TextArea
          aria-label="回报具体内容"
          value={draft.description ?? ''}
          maxLength={5000}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </label>
      <label>
        {draft.type === 'cash' ? '支付安排' : '交接／使用约定'}
        <Input.TextArea
          value={draft.handover ?? ''}
          maxLength={2000}
          onChange={(e) => patch({ handover: e.target.value })}
        />
      </label>
      <div className="reward-editor-actions">
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>
          保存修改
        </Button>
      </div>
    </div>
  );
}
