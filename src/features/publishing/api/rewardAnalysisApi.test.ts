import { describe, expect, it } from 'vitest';
import { rewardAnalysisSchema } from './rewardAnalysisApi';
describe('回报整理状态协议', () => {
  const job = { taskId: 'RWD-1', requirementNo: 'REQ-1', description: '现金1000元', result: null };
  it('在接口边界统一后端状态并兼容早期任务', () => {
    expect(rewardAnalysisSchema.parse({ ...job, status: 'processing' }).status).toBe('PROCESSING');
    expect(rewardAnalysisSchema.parse({ ...job, status: 'SUCCESS' }).status).toBe('SUCCESS');
  });
  it('拒绝未知状态，避免错误停止或持续轮询', () => {
    expect(rewardAnalysisSchema.safeParse({ ...job, status: 'unknown' }).success).toBe(false);
  });
});
