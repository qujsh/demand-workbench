import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { getNote } from '../api/noteApi';
import type { NoteRecord } from '../noteModels';
import type { useNotes } from './useNotes';
import { useNoteDetailNavigation } from './useNoteDetailNavigation';

vi.mock('../api/noteApi', () => ({ getNote: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const note = (id: string): NoteRecord => ({
  id,
  title: id,
  body: id,
  date: '2026-11-20',
  tags: [],
  images: [],
  visibility: 'private',
});
function setup(items = [note('a'), note('b')]) {
  const setDetail = vi.fn();
  const report = vi.fn();
  const query = {
    isFetching: false,
    hasPreviousPage: false,
    hasNextPage: false,
    fetchPreviousPage: vi.fn(),
    fetchNextPage: vi.fn(),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const hook = renderHook(
    ({ current }: { current: NoteRecord | null }) =>
      useNoteDetailNavigation(
        current,
        items,
        query as unknown as ReturnType<typeof useNotes>['records'],
        setDetail,
        report,
      ),
    {
      initialProps: { current: items[0] as NoteRecord | null },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  return { ...hook, query, setDetail, report, items };
}
it('只沿当前筛选列表浏览，边界隐藏且重复点击不重复请求', async () => {
  const s = setup();
  expect(s.result.current.previous).toBe(false);
  expect(s.result.current.next).toBe(true);
  vi.mocked(getNote).mockResolvedValue(note('b'));
  await act(async () => {
    await Promise.all([s.result.current.move('next'), s.result.current.move('next')]);
  });
  expect(getNote).toHaveBeenCalledExactlyOnceWith('b');
  expect(s.setDetail).toHaveBeenCalledWith(note('b'));
  expect(s.query.fetchNextPage).not.toHaveBeenCalled();
});
it('跨页从返回结果按当前编号定位，兼容缓存淘汰后反向加载', async () => {
  const s = setup([note('b')]);
  s.query.hasNextPage = true;
  s.query.fetchNextPage.mockResolvedValue({ data: { pages: [{ items: [note('b'), note('c')] }] } });
  vi.mocked(getNote).mockImplementation(async (id) => note(id));
  await act(async () => {
    await s.result.current.move('next');
  });
  expect(s.setDetail).toHaveBeenLastCalledWith(note('c'));
  s.query.hasPreviousPage = true;
  s.query.fetchPreviousPage.mockResolvedValue({
    data: { pages: [{ items: [note('a'), note('b')] }] },
  });
  await act(async () => {
    await s.result.current.move('previous');
  });
  expect(s.setDetail).toHaveBeenLastCalledWith(note('a'));
});
it('分页失败保留当前详情并提示错误', async () => {
  const s = setup([note('a')]);
  s.query.hasNextPage = true;
  s.query.fetchNextPage.mockRejectedValue(new Error('分页失败'));
  await act(async () => {
    await s.result.current.move('next');
  });
  expect(s.setDetail).not.toHaveBeenCalled();
  expect(s.report).toHaveBeenCalledWith(expect.objectContaining({ message: '分页失败' }));
  expect(s.result.current.loading).toBe(false);
});
it('关闭详情后丢弃迟到的详情响应', async () => {
  const s = setup();
  let finish!: (record: NoteRecord) => void;
  vi.mocked(getNote).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  let pending!: Promise<void>;
  act(() => {
    pending = s.result.current.move('next');
  });
  s.rerender({ current: null });
  await act(async () => {
    finish(note('b'));
    await pending;
  });
  expect(s.setDetail).not.toHaveBeenCalled();
});
