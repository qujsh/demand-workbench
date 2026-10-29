import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CategoryManagement from './CategoryManagement';
import {
  getCategoryUsage,
  deleteCategory,
  getCategoryMigrations,
  getCategoryMigrationTasks,
} from '../api/categoryMigrationApi';
vi.mock('../api/categoryMigrationApi', () => ({
  getCategoryUsage: vi.fn(),
  deleteCategory: vi.fn(),
  getCategoryMigrations: vi.fn(),
  getCategoryMigrationTasks: vi.fn(),
}));
import {
  getManagedTaskCategories,
  updateTaskCategory,
  createTaskCategory,
} from '../api/taskContentApi';
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
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.mocked(getCategoryUsage).mockResolvedValue(1);
  vi.mocked(deleteCategory).mockResolvedValue('CM-test');
  vi.mocked(getCategoryMigrations).mockResolvedValue([
    {
      migrationNo: 'CM-test',
      sourceCode: 'old',
      sourceName: '旧分类',
      targetCode: 'design',
      targetName: '设计创意',
      actorName: '测试发布人',
      taskCount: 1,
      createdAt: '2026-10-29T12:00:00',
    },
  ]);
  vi.mocked(getCategoryMigrationTasks).mockResolvedValue([
    { taskNo: 'TASK-1', taskTitle: '迁移前任务', formalChanged: true, draftChanged: true },
  ]);
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

it('新增分类必须填写有效英文编号，并提交原值', async () => {
  vi.mocked(createTaskCategory).mockResolvedValue(category);
  page();
  fireEvent.click(screen.getByRole('button', { name: '新增分类' }));
  fireEvent.change(screen.getByRole('textbox', { name: '分类名称' }), {
    target: { value: '宠物照护' },
  });
  const button = screen.getByRole('button', { name: '创建分类' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: '英文编号' }), {
    target: { value: 'Pet Care' },
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: '英文编号' }), {
    target: { value: 'pet_care' },
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(createTaskCategory).toHaveBeenCalledWith('pet_care', '宠物照护', 1000, true),
  );
});

it('删除有关联任务的分类时必须选择其他分类，取消不写入', async () => {
  page();
  fireEvent.click(await screen.findByRole('button', { name: '删除' }));
  await screen.findByText('当前关联 1 个任务（含已保存草稿，任务去重）。');
  expect((screen.getByRole('button', { name: '确认删除' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
  expect(deleteCategory).not.toHaveBeenCalled();
});
it('迁移记录可追溯旧分类关联的具体任务', async () => {
  page();
  fireEvent.click(screen.getByRole('tab', { name: '迁移记录' }));
  await screen.findByText('旧分类');
  fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
  await screen.findByText('TASK-1');
  expect(screen.getByText('迁移前任务')).toBeTruthy();
});
