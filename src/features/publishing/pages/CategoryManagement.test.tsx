import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CategoryManagement from './CategoryManagement';
import { getManagedTaskCategories, updateTaskCategory } from '../api/taskContentApi';
vi.mock('../api/taskContentApi', () => ({
  getManagedTaskCategories: vi.fn(),
  createTaskCategory: vi.fn(),
  updateTaskCategory: vi.fn(),
}));
const category = {
  code: 'design',
  name: '设计创意',
  sortOrder: 20,
  enabled: true,
  source: 'user',
  creatorName: '测试发布人',
  createdAt: '2026-10-28T12:00:00',
};
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }),
  );
  vi.mocked(getManagedTaskCategories).mockResolvedValue([category]);
  vi.mocked(updateTaskCategory).mockResolvedValue(category);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function page(returnPath?: string) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <CategoryManagement returnPath={returnPath} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it('独立入口不显示返回发布按钮，搜索请求传递关键词', async () => {
  page();
  await screen.findByText('测试发布人');
  expect(screen.queryByText('返回发布任务')).toBeNull();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索分类' }), {
    target: { value: '摄影' },
  });
  fireEvent.keyDown(screen.getByRole('searchbox', { name: '搜索分类' }), {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
  });
  await waitFor(() =>
    expect(getManagedTaskCategories).toHaveBeenLastCalledWith('摄影', expect.any(AbortSignal)),
  );
});
it('发布入口保留返回提示，编辑名称排序和启停状态后提交原编号', async () => {
  page('/requirements/REQ-1/publish');
  expect(screen.getByText('返回发布任务')).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: '编辑' }));
  fireEvent.change(screen.getByRole('textbox', { name: '编辑分类名称' }), {
    target: { value: '视觉设计' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: '分类展示排序' }), {
    target: { value: '5' },
  });
  fireEvent.click(screen.getByRole('switch', { name: '启用分类' }));
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  await waitFor(() =>
    expect(updateTaskCategory).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'design', name: '视觉设计', sortOrder: 5, enabled: false }),
      expect.anything(),
    ),
  );
});
