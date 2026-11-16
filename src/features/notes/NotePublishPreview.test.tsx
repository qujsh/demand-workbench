import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import { NotePublishPreview } from './NotePublishPreview';
import type { NoteRecord } from './noteModels';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
afterEach(cleanup);
const record: NoteRecord = {
  id: 'preview',
  title: '未保存标题',
  body: '<b>按 C 端纯文本展示</b>',
  date: '2026-11-12T10:00',
  tags: [],
  visibility: 'private',
  images: [],
};
const desktop = () => within(document.querySelector('.note-preview-desktop') as HTMLElement);
const mobile = () => within(screen.getByRole('complementary', { name: '手机端预览' }));
function show(images: string[], detail = false) {
  const onClose = vi.fn();
  render(
    <AuthContext.Provider
      value={{ user: { userNo: 'qa', nickname: '作者', status: 'active' }, logout: async () => {} }}
    >
      <NotePublishPreview
        record={{ ...record, images }}
        onClose={onClose}
        detail={detail}
        actions={<button>编辑</button>}
        status={<span>审核状态</span>}
      />
    </AuthContext.Provider>,
  );
  return onClose;
}
it('纯文字预览保留原文并允许返回编辑', () => {
  const onClose = show([]);
  expect(desktop().getByText(record.body)).toBeTruthy();
  expect(desktop().queryByLabelText('预览图片')).toBeNull();
  fireEvent.keyDown(document.querySelector('.ant-modal-wrap')!, { key: 'Escape', keyCode: 27 });
  expect(onClose).toHaveBeenCalledOnce();
});
it('多图初始页码及轮播边界正确', () => {
  show(['/one.png', '/two.png']);
  expect(mobile().getByText('1 / 2')).toBeTruthy();
  expect(mobile().getByRole('button', { name: '上一张图片' }).hasAttribute('disabled')).toBe(true);
  const track = mobile().getByAltText('笔记配图 1').parentElement!;
  Object.defineProperty(track, 'clientWidth', { value: 400 });
  Object.defineProperty(track, 'scrollLeft', { value: 400 });
  fireEvent.scroll(track);
  expect(mobile().getByText('2 / 2')).toBeTruthy();
  expect(mobile().getByRole('button', { name: '下一张图片' }).hasAttribute('disabled')).toBe(true);
});
it('在封面和笔记之间切换，使用第一张配图且保留未保存内容', () => {
  show(['/first.png', '/second.png']);
  fireEvent.click(mobile().getByText('封面预览'));
  expect(mobile().getByAltText('笔记封面').getAttribute('src')).toBe('/first.png');
  expect(mobile().getByText('未保存标题')).toBeTruthy();
  expect(mobile().queryByLabelText('预览图片')).toBeNull();
  expect(desktop().getByText(record.body)).toBeTruthy();
  expect(screen.getAllByText('封面预览')).toHaveLength(1);
  fireEvent.click(mobile().getByText('笔记预览'));
  expect(mobile().getByText(record.body)).toBeTruthy();
  expect(mobile().getByText('1 / 2')).toBeTruthy();
});
it('无图时封面模式展示文字卡片', () => {
  show([]);
  fireEvent.click(mobile().getByText('封面预览'));
  expect(mobile().queryByAltText('笔记封面')).toBeNull();
  expect(mobile().getByLabelText('C 端笔记卡片').textContent).toContain(record.body);
});

it('记录详情复用手机预览布局并保留编辑入口与状态', () => {
  show([], true);
  expect(screen.getByText('记录详情')).toBeTruthy();
  expect(screen.getByRole('button', { name: '编辑' })).toBeTruthy();
  expect(desktop().getByText('审核状态')).toBeTruthy();
  expect(desktop().getByText('仅自己可见', { exact: false })).toBeTruthy();
  fireEvent.click(mobile().getByText('封面预览'));
  expect(mobile().getByLabelText('C 端笔记卡片')).toBeTruthy();
  expect(desktop().getByText(record.body)).toBeTruthy();
});
