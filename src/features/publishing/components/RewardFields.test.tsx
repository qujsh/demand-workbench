import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RewardFields } from './RewardFields';
import { emptyTaskContent } from './taskContentDefaults';
import {
  getRewardAnalysis,
  submitRewardAnalysis,
  type RewardAnalysisJob,
} from '../api/rewardAnalysisApi';
import type { PublicContent, RewardItem } from '../api/taskContentApi';
vi.mock('../api/rewardAnalysisApi', () => ({
  getRewardAnalysis: vi.fn(),
  submitRewardAnalysis: vi.fn(),
}));
const cash: RewardItem = {
  type: 'cash',
  title: '项目报酬',
  pricing: 'range',
  amountMin: 1000,
  amountMax: 2000,
  unit: '项目',
  quantity: null,
  condition: null,
  description: null,
  handover: '验收后支付',
};
const job: RewardAnalysisJob = {
  taskId: 'RWD-1',
  requirementNo: 'REQ-1',
  description: '现金1000-2000元',
  status: 'SUCCESS',
  result: { rewards: [cash], missingInformation: [], reviewStatus: 'allowed', reviewMessage: null },
};
function mount(initial = emptyTaskContent()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Form() {
    const [value, setValue] = useState<PublicContent>(initial);
    return (
      <>
        <RewardFields
          value={value}
          requirementNo="REQ-1"
          onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
        />
        <output data-testid="saved">{JSON.stringify(value.details)}</output>
      </>
    );
  }
  return render(
    <QueryClientProvider client={client}>
      <Form />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.resetAllMocks();
  vi.mocked(submitRewardAnalysis).mockResolvedValue(job);
  vi.mocked(getRewardAnalysis).mockResolvedValue(job);
});
afterEach(() => cleanup());
describe('自然语言回报流程', () => {
  it('整理金额区间、确认，改描述后立即撤销确认；图片不开放', async () => {
    const user = userEvent.setup();
    mount();
    expect(
      (screen.getByRole('button', { name: '回报图片上传暂未开放' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.type(screen.getByRole('textbox', { name: '回报描述' }), job.description);
    await user.click(screen.getByRole('button', { name: 'AI 整理回报' }));
    await screen.findByText('¥1,000～2,000 / 项目');
    const confirm = screen.getByRole('checkbox');
    await waitFor(() => expect((confirm as HTMLInputElement).disabled).toBe(false));
    await user.click(confirm);
    expect(screen.getByTestId('saved').textContent).toContain('"rewardConfirmed":true');
    await user.type(screen.getByRole('textbox', { name: '回报描述' }), '，另送会员卡');
    expect((confirm as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('saved').textContent).toContain('"rewardConfirmed":false');
  });
  it('风险和缺失信息不允许确认', async () => {
    const blocked = {
      ...job,
      result: {
        ...job.result!,
        reviewStatus: 'blocked' as const,
        reviewMessage: '该回报存在风险',
        missingInformation: ['请补充数量'],
      },
    };
    vi.mocked(submitRewardAnalysis).mockResolvedValue(blocked);
    vi.mocked(getRewardAnalysis).mockResolvedValue(blocked);
    mount({
      ...emptyTaskContent(),
      details: { collaboration: '', rewards: [], rewardDescription: job.description },
    });
    await userEvent.click(screen.getByRole('button', { name: 'AI 整理回报' }));
    await screen.findByText('该回报存在风险');
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('请补充数量')).not.toBeNull();
  });
  it('迟到的整理响应不能覆盖已经改过的描述', async () => {
    let finish!: (j: RewardAnalysisJob) => void;
    vi.mocked(submitRewardAnalysis).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mount({
      ...emptyTaskContent(),
      details: { collaboration: '', rewards: [], rewardDescription: job.description },
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'AI 整理回报' }));
    await user.type(screen.getByRole('textbox', { name: '回报描述' }), '，新约定');
    await act(async () => finish(job));
    expect(screen.queryByText('¥1,000～2,000 / 项目')).toBeNull();
    expect((screen.getByRole('textbox', { name: '回报描述' }) as HTMLTextAreaElement).value).toBe(
      job.description + '，新约定',
    );
  });
  it('恢复已确认草稿时保持确认勾选，查询完成后可继续操作', async () => {
    mount({
      ...emptyTaskContent(),
      details: {
        collaboration: '',
        rewards: [cash],
        rewardDescription: job.description,
        rewardAnalysisId: job.taskId,
        rewardAppliedId: job.taskId,
        rewardConfirmed: true,
      },
    });
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    await waitFor(() =>
      expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false),
    );
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
  it('恢复草稿时不覆盖用户已编辑但尚未复核的条目', async () => {
    const edited = { ...cash, amountMax: 1800 };
    mount({
      ...emptyTaskContent(),
      details: {
        collaboration: '',
        rewards: [edited],
        rewardDescription: job.description,
        rewardAnalysisId: job.taskId,
        rewardAppliedId: job.taskId,
        rewardConfirmed: false,
      },
    });
    await screen.findByText('条目已修改，请复核后确认。');
    expect(screen.getByText('¥1,000～1,800 / 项目')).not.toBeNull();
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: '复核修改' }));
    expect(submitRewardAnalysis).toHaveBeenCalledWith('REQ-1', job.description, [edited]);
  });
});
