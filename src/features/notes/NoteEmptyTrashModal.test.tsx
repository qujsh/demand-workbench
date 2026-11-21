import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getTrashPreview } from './api/noteApi';
import { NoteEmptyTrashModal } from './NoteEmptyTrashModal';

vi.mock('./api/noteApi', () => ({ getTrashPreview: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function setup(pending = false) {
  const confirm = vi.fn().mockResolvedValue(undefined);
  const cancel = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NoteEmptyTrashModal pending={pending} onConfirm={confirm} onCancel={cancel} />
    </QueryClientProvider>,
  );
  return { confirm, cancel };
}
it('显示整个回收站数量，只有明确确认才提交指纹', async () => {
  vi.mocked(getTrashPreview).mockResolvedValue({ recordCount: 12, fingerprint: 'snapshot-one' });
  const { confirm, cancel } = setup();
  expect(await screen.findByText(/将清空全部 12 条回收站笔记，删除后无法恢复/)).toBeTruthy();
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '取 消' }));
  expect(cancel).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '清空回收站' }));
  await waitFor(() => expect(confirm).toHaveBeenCalledWith('snapshot-one'));
});
it('回收站为空时禁止提交', async () => {
  vi.mocked(getTrashPreview).mockResolvedValue({ recordCount: 0, fingerprint: 'snapshot-empty' });
  setup();
  expect(await screen.findByText('回收站已为空。')).toBeTruthy();
  expect(screen.getByRole('button', { name: '清空回收站' })).toHaveProperty('disabled', true);
});
it('预览失败时禁止提交，保留重试', async () => {
  vi.mocked(getTrashPreview).mockRejectedValue(new Error('offline'));
  const { confirm } = setup();
  expect(await screen.findByText('无法获取回收站数量')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '清空回收站' }));
  expect(confirm).not.toHaveBeenCalled();
});
it('执行期间禁止取消', async () => {
  vi.mocked(getTrashPreview).mockResolvedValue({ recordCount: 1, fingerprint: 'snapshot-one' });
  setup(true);
  expect(screen.getByRole('button', { name: '取 消' })).toHaveProperty('disabled', true);
});
