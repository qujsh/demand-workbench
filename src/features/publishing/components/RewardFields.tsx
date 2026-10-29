import { Button, Input, InputNumber, Select } from 'antd';
import type { PublicContent, RewardItem } from '../api/taskContentApi';
const types = [
  { value: 'cash', label: '现金回报' },
  { value: 'goods', label: '物品交换' },
  { value: 'service', label: '服务交换' },
  { value: 'mixed', label: '组合回报' },
];
const blank = (type: RewardItem['type']): RewardItem => ({
  type,
  title: '',
  pricing: type === 'cash' ? 'fixed' : null,
  amountMin: null,
  amountMax: null,
  unit: type === 'cash' ? '项目' : '件',
  quantity: type === 'goods' ? 1 : null,
  condition: null,
  description: null,
  handover: null,
});
export function RewardFields({
  value,
  onChange,
}: {
  value: PublicContent;
  onChange: (v: Partial<PublicContent>) => void;
}) {
  const items = value.details?.rewards ?? [];
  const update = (rewards: RewardItem[], rewardType = value.rewardType) =>
    onChange({
      rewardType,
      amountMin: null,
      amountMax: null,
      details: {
        goal: value.details?.goal ?? '',
        collaboration: value.details?.collaboration ?? '',
        rewards,
      },
    });
  const patch = (index: number, fields: Partial<RewardItem>) =>
    update(items.map((r, i) => (i === index ? { ...r, ...fields } : r)));
  return (
    <section className="reward-fields">
      <label>
        回报方式
        <Select
          aria-label="回报方式"
          value={value.rewardType}
          options={types}
          onChange={(type) =>
            update(
              type === 'mixed'
                ? [blank('cash'), blank('goods')]
                : [blank(type as RewardItem['type'])],
              type,
            )
          }
        />
      </label>
      {!items.length && (
        <Button onClick={() => update([blank('cash')], 'cash')}>填写现金回报</Button>
      )}
      {items.map((r, i) => (
        <div className="reward-edit-card" key={i}>
          <div className="form-grid">
            <label>
              回报条目 {i + 1}
              {value.rewardType === 'mixed' && (
                <Select
                  value={r.type}
                  options={types.slice(0, 3)}
                  onChange={(type) => patch(i, blank(type as RewardItem['type']))}
                />
              )}
            </label>
            <label>
              名称 · 必填
              <Input
                value={r.title}
                maxLength={255}
                placeholder={
                  r.type === 'cash'
                    ? '项目报酬'
                    : r.type === 'goods'
                      ? '例如：九成新显示器'
                      : '例如：品牌咨询服务'
                }
                onChange={(e) => patch(i, { title: e.target.value })}
              />
            </label>
          </div>
          {r.type === 'cash' ? (
            <>
              <div className="form-grid">
                <label>
                  报价形式
                  <Select
                    value={r.pricing}
                    options={[
                      { value: 'fixed', label: '固定金额' },
                      { value: 'range', label: '金额区间' },
                    ]}
                    onChange={(pricing) =>
                      patch(i, {
                        pricing,
                        amountMax: pricing === 'fixed' ? r.amountMin : r.amountMax,
                      })
                    }
                  />
                </label>
                <label>
                  计价单位
                  <Select
                    value={r.unit ?? '项目'}
                    options={['项目', '小时', '天', '次', '件'].map((v) => ({
                      value: v,
                      label: v,
                    }))}
                    onChange={(v) => patch(i, { unit: v })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  金额／下限 ¥
                  <InputNumber
                    min={0.01}
                    precision={2}
                    value={r.amountMin}
                    onChange={(v) =>
                      patch(i, { amountMin: v, ...(r.pricing === 'fixed' ? { amountMax: v } : {}) })
                    }
                  />
                </label>
                {r.pricing === 'range' && (
                  <label>
                    金额上限 ¥
                    <InputNumber
                      min={0.01}
                      precision={2}
                      value={r.amountMax}
                      onChange={(v) => patch(i, { amountMax: v })}
                    />
                  </label>
                )}
              </div>
            </>
          ) : (
            <>
              {r.type === 'goods' && (
                <>
                  <div className="form-grid">
                    <label>
                      数量
                      <InputNumber
                        min={0.01}
                        precision={2}
                        value={r.quantity}
                        onChange={(v) => patch(i, { quantity: v })}
                      />
                    </label>
                    <label>
                      单位
                      <Input
                        value={r.unit ?? ''}
                        maxLength={32}
                        onChange={(e) => patch(i, { unit: e.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    成色／使用情况 · 必填
                    <Input
                      value={r.condition ?? ''}
                      maxLength={500}
                      onChange={(e) => patch(i, { condition: e.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                {r.type === 'goods' ? '物品规格与包含内容' : '服务范围与交付内容'} · 必填
                <Input.TextArea
                  value={r.description ?? ''}
                  maxLength={5000}
                  onChange={(e) => patch(i, { description: e.target.value })}
                />
              </label>
            </>
          )}
          {r.type === 'cash' && (
            <label>
              回报补充说明
              <Input.TextArea
                value={r.description ?? ''}
                maxLength={5000}
                onChange={(e) => patch(i, { description: e.target.value })}
              />
            </label>
          )}
          <label>
            {r.type === 'cash' ? '支付安排说明（仅展示）' : '交接／使用约定（仅展示）'}
            <Input.TextArea
              value={r.handover ?? ''}
              maxLength={2000}
              onChange={(e) => patch(i, { handover: e.target.value })}
            />
          </label>
          {value.rewardType === 'mixed' && (
            <Button danger onClick={() => update(items.filter((_, index) => index !== i))}>
              移除此条
            </Button>
          )}
        </div>
      ))}
      {value.rewardType === 'mixed' && items.length < 12 && (
        <Button onClick={() => update([...items, blank('service')])}>添加回报条目</Button>
      )}
      <p className="publication-node-meta">
        物品和服务不折算为现金；组合回报至少包含两项。平台不提供支付、物流或履约担保。
      </p>
    </section>
  );
}
