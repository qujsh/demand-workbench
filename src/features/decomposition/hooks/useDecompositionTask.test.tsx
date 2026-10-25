import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryDecomposition } from '../api/decompositionApi';
import { useDecompositionTask } from './useDecompositionTask';

vi.mock('../api/decompositionApi', () => ({
  queryDecomposition: vi.fn(),
  submitDecomposition: vi.fn(),
}));

describe('useDecompositionTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a persisted decomposition when an initial task id is provided', async () => {
    vi.mocked(queryDecomposition).mockResolvedValue({
      taskId: 'DEC-001',
      status: 'SUCCESS',
      stage: 'COMPLETED',
      message: '工作项拆解完成',
      summary: { moduleCount: 1, featureCount: 0, workItemCount: 1, subtaskCount: 0 },
      modules: [
        {
          id: 'MODULE-001',
          type: 'module',
          name: '社区',
          status: '未开始',
          priority: '中',
          children: [],
        },
      ],
      errorCode: null,
      createdAt: '2026-10-13T09:00:00',
      completedAt: '2026-10-13T09:01:00',
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDecompositionTask('DEC-001'), { wrapper });

    await waitFor(() => expect(result.current.task?.status).toBe('SUCCESS'));
    expect(queryDecomposition).toHaveBeenCalledWith('DEC-001', expect.any(AbortSignal));
    expect(result.current.task).toHaveProperty('modules', expect.any(Array));
  });
});
