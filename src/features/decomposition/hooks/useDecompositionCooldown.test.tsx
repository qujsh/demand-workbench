import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useDecompositionCooldown } from './useDecompositionCooldown';

afterEach(() => vi.useRealTimers());
it('一次点击锁定所有共享入口，满30秒后允许再次激活', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useDecompositionCooldown());
  act(() => { expect(result.current.activate()).toBe(true); });
  expect(result.current.coolingDown).toBe(true);
  act(() => { expect(result.current.activate()).toBe(false); vi.advanceTimersByTime(29_999); });
  expect(result.current.coolingDown).toBe(true);
  expect(result.current.activate()).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.coolingDown).toBe(false);
  act(() => { expect(result.current.activate()).toBe(true); });
  expect(result.current.coolingDown).toBe(true);
});
