import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getTagDeleteImpact } from './api/noteApi';
import { NoteTagDeleteModal } from './NoteTagDeleteModal';

vi.mock('./api/noteApi', () => ({ getTagDeleteImpact: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const impact = {
  tagNo: 'TAG-one',
  name: '父/子',
  orderVersion: 5,
  affectedRecordCount: 4,
  savedRecordCount: 3,
  draftRecordCount: 1,
};
function setup(canDeleteRecords = true) {
  const onDelete = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NoteTagDeleteModal
        tag={{ tagNo: 'TAG-one', name: '父/子' }}
        canDeleteRecords={canDeleteRecords}
        onCancel={vi.fn()}
        onDelete={onDelete}
      />
    </QueryClientProvider>,
  );
  return onDelete;
}
it('默认只删除标签，不把笔记删除范围传入提交', async () => {
  vi.mocked(getTagDeleteImpact).mockResolvedValue(impact);
  const onDelete = setup();
  fireEvent.click(screen.getByRole('button', { name: '仅删除标签' }));
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith(undefined));
});
it('选择删除笔记时说明随选项切换，不显示黄色提示，并携带确认版本提交', async () => {
  vi.mocked(getTagDeleteImpact).mockResolvedValue(impact);
  const onDelete = setup();
  fireEvent.click(screen.getByRole('radio', { name: /删除标签，并删除标签下的所有笔记/ }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '删除标签并移入回收站' })).toHaveProperty(
      'disabled',
      false,
    ),
  );
  expect(
    screen.getByText(
      '删除当前标签，并将当前及所有子标签关联的笔记移入回收站；子标签保留，笔记可恢复。',
    ),
  ).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '删除标签并移入回收站' }));
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith(impact));
});
it('无删除笔记权限时禁止选择批量删除', () => {
  vi.mocked(getTagDeleteImpact).mockResolvedValue(impact);
  setup(false);
  expect(
    (screen.getByRole('radio', { name: /删除标签，并删除标签下的所有笔记/ }) as HTMLInputElement)
      .disabled,
  ).toBe(true);
});
it('无法获取影响数量时禁止删除笔记', async () => {
  vi.mocked(getTagDeleteImpact).mockRejectedValue(new Error('offline'));
  const onDelete = setup();
  fireEvent.click(screen.getByRole('radio', { name: /删除标签，并删除标签下的所有笔记/ }));
  expect(await screen.findByText('无法获取影响范围，请重试')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: '删除标签并移入回收站' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(onDelete).not.toHaveBeenCalled();
});
