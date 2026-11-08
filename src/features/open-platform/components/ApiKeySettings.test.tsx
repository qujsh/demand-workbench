import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiKeySettings } from './ApiKeySettings';

const key = {
  keyNo: 'KEY-test',
  name: 'Codex',
  prefix: 'dw_sk_example',
  scopes: ['shares:read'],
  createdAt: '2026-11-06T00:00:00Z',
  expiresAt: '2027-01-01T00:00:00Z',
  revokedAt: null,
  lastUsedAt: null,
};
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('创建后仅在弹窗展示明文，关闭后移除，Query缓存不含完整密钥', async () => {
  const token = 'dw_sk_one_time_secret';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            msg: url.endsWith('/create') ? { key, secret: token } : [key],
            errorCode: '',
            errorMsg: '',
          }),
          { status: 200 },
        ),
      ),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ApiKeySettings />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '创建 API 密钥' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('名称'), { target: { value: 'My Codex' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '创建密钥' }));
  await screen.findByText(token);
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
    ),
  ).not.toContain(token);
  fireEvent.click(screen.getByRole('button', { name: '我已保存，关闭' }));
  await waitFor(() => expect(screen.queryByText(token)).toBeNull());
});

it('永久密钥在列表简洁展示，编号和完整时间放入详情弹窗', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, msg: [{ ...key, expiresAt: null }] })),
      ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ApiKeySettings />
    </QueryClientProvider>,
  );
  await screen.findByText('Codex');
  expect(screen.queryByText(key.keyNo)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '详情' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(key.keyNo)).toBeTruthy();
  expect(within(dialog).getByText('永久有效')).toBeTruthy();
  expect(within(dialog).getByText('最近使用')).toBeTruthy();
});
