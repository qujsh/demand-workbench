import type { RewardItem } from '../api/taskContentApi';
export function rewardItemTitle(r: RewardItem): string {
  if (r.type === 'cash')
    return `¥${r.amountMin?.toLocaleString('zh-CN') ?? '待补充'}${r.pricing === 'range' ? `～${r.amountMax?.toLocaleString('zh-CN') ?? '待补充'}` : ''} / ${r.unit ?? '项目'}`;
  return `${r.title}${r.quantity !== null ? ` × ${r.quantity}${r.unit ?? ''}` : ''}`;
}
