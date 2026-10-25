import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishTask, savePublishTask, discardPublishDraft } from '../api/publishTaskApi';
import { usePublishTask } from './usePublishTask';

vi.mock('../api/publishTaskApi', () => ({
  getPublishTask: vi.fn(),
  savePublishTask: vi.fn(),
  discardPublishDraft: vi.fn(),
}));

const task = {
  taskNo: 'TASK-000001',
  requirementNo: 'REQ-1',
  decompositionNo: 'DEC-1',
  status: 'published' as const,
  title: '任务',
  category: '',
  summary: '简介',
  skills: '',
  experience: '不限',
  recruitCount: 1,
  priceModel: '固定价格',
  budget: '',
  startDate: null,
  deadline: null,
  workMode: '待定',
  recruitMode: '报名审核',
  visibility: '所有人可见',
  publishedAt: '2026-10-14T07:00:00',
};

describe('usePublishTask', () => {
  beforeEach(() => {
    vi.mocked(getPublishTask).mockResolvedValue(null);
    vi.mocked(savePublishTask).mockResolvedValue(task);
  });

  it('refreshes the requirement list before a published mutation completes', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => usePublishTask('REQ-1'), { wrapper });

    await act(async () => {
      await result.current.save({
        status: 'published',
        title: '任务',
        category: '',
        summary: '简介',
        skills: '',
        experience: '不限',
        recruitCount: 1,
        priceModel: '固定价格',
        budget: '',
        startDate: null,
        deadline: null,
        workMode: '待定',
        recruitMode: '报名审核',
        visibility: '所有人可见',
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['requirements'] });
  });
  it('放弃草稿后查询缓存恢复正式版本，未发布时清空缓存', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => usePublishTask('REQ-1'), { wrapper });
    vi.mocked(discardPublishDraft).mockResolvedValue(task);
    await act(async () => {
      await result.current.discard();
    });
    expect(client.getQueryData(['publish-task', 'REQ-1'])).toEqual(task);
    vi.mocked(discardPublishDraft).mockResolvedValue(null);
    await act(async () => {
      await result.current.discard();
    });
    expect(client.getQueryData(['publish-task', 'REQ-1'])).toBeNull();
  });
});
