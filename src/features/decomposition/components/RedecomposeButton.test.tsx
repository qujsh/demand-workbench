import { App } from 'antd';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedecomposeButton } from './RedecomposeButton';

beforeEach(() => {
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => computedStyle(element));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('重新拆解确认', () => {
  it('已有工作项时取消不会提交，明确确认后才提交', async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    const onActivate = vi.fn().mockReturnValue(true);
    const user = userEvent.setup();
    render(<App><RedecomposeButton hasExisting pending={false} onActivate={onActivate} onStart={onStart} /></App>);
    await user.click(screen.getByRole('button', { name: /^重新拆解$/ }));
    expect(onStart).not.toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /取\s*消/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onStart).not.toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /^重新拆解$/ }));
    await user.click(screen.getByRole('button', { name: '确认重新拆解' }));
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('冷却期间禁止再次提交', async () => {
    const onStart = vi.fn();
    render(<App><RedecomposeButton hasExisting pending coolingDown onStart={onStart} /></App>);
    const button = screen.getByRole('button', { name: '重新拆解' });
    expect(button.hasAttribute('disabled')).toBe(true);
    await userEvent.click(button);
    expect(onStart).not.toHaveBeenCalled();
  });
});
