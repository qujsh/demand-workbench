import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useShareEditorLayout } from './useShareEditorLayout';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('switches detached/expanded modes and clears modal listeners and timers on unmount', () => {
  vi.useFakeTimers();
  const modal = document.createElement('div');
  modal.className = 'share-editor-modal';
  const layout = document.createElement('div');
  modal.append(layout);
  const add = vi.spyOn(modal, 'addEventListener');
  const remove = vi.spyOn(modal, 'removeEventListener');
  const { result, unmount } = renderHook(() => useShareEditorLayout());
  act(() => result.current.setLayoutNode(layout));
  expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), true);
  act(() => result.current.setExpanded(true));
  act(() => result.current.toggleDetached());
  expect(result.current.detached).toBe(true);
  expect(result.current.expanded).toBe(false);
  expect(result.current.editorPosition).toEqual({ x: 16, y: 20 });
  unmount();
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
  expect(vi.getTimerCount()).toBe(0);
});
