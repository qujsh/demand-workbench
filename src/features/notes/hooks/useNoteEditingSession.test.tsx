import { act, cleanup, renderHook } from '@testing-library/react';
import { App } from 'antd';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNoteEditingSession } from './useNoteEditingSession';
import type { useNotes } from './useNotes';
import type { NoteRecord } from '../noteModels';

vi.mock('../api/noteApi', () => ({ getNote: vi.fn() }));
afterEach(cleanup);
const record: NoteRecord = {
  id: 'new',
  title: '未保存',
  body: '草稿',
  images: [],
  tags: [],
  date: '2026-11-08T10:00',
  visibility: 'private',
  draft: true,
};
const wrapper = ({ children }: PropsWithChildren) => <App>{children}</App>;
it('retains the editor on failed save and closes only after persistence succeeds', async () => {
  const mutateAsync = vi
    .fn()
    .mockRejectedValueOnce(new Error('conflict'))
    .mockResolvedValueOnce({});
  const data = { save: { mutateAsync }, change: { mutateAsync: vi.fn() } } as unknown as Pick<
    ReturnType<typeof useNotes>,
    'save' | 'change'
  >;
  const onSaved = vi.fn();
  const reportError = vi.fn();
  const { result } = renderHook(
    () => useNoteEditingSession(data, () => true, reportError, onSaved),
    { wrapper },
  );
  act(() => result.current.startNewRecord());
  expect(result.current.editor).toBe('new');
  await act(async () => {
    await expect(result.current.save(record)).rejects.toThrow('conflict');
  });
  expect(result.current.editor).toBe('new');
  expect(onSaved).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.save(record);
  });
  expect(result.current.editor).toBeNull();
  expect(onSaved).toHaveBeenCalledWith(record);
});
it('does not open an editor without create permission', () => {
  const data = { save: {}, change: {} } as Pick<ReturnType<typeof useNotes>, 'save' | 'change'>;
  const { result } = renderHook(() => useNoteEditingSession(data, () => false, vi.fn(), vi.fn()), {
    wrapper,
  });
  act(() => result.current.startNewRecord());
  expect(result.current.editor).toBeNull();
});
