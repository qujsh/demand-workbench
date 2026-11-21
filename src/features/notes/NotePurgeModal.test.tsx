import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotePurgeModal } from './NotePurgeModal';
import type { NoteRecord } from './noteModels';

afterEach(cleanup);
const record = { id: 'NOTE-purge', title: '测试笔记' } as NoteRecord;
it('明确说明不可恢复与图片清理，只有确认才调用删除', () => {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <NotePurgeModal record={record} pending={false} onConfirm={onConfirm} onCancel={onCancel} />,
  );
  expect(screen.getByText(/删除后无法恢复/)).toBeTruthy();
  expect(screen.getByText(/文件图片也将一并删除！/)).toBeTruthy();
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '取 消' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '彻底删除' }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
it('删除执行期间禁止取消和重复提交', () => {
  render(<NotePurgeModal record={record} pending onConfirm={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByRole('button', { name: '取 消' })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: '关闭' })).toBeNull();
});
