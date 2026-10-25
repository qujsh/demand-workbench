import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LoginBackground } from './LoginBackground';

vi.mock('../api/authApi', () => ({
  getLoginBackground: vi.fn(async () => ({ url: 'https://cn.bing.com/today.jpg', copyright: '今日图片版权' })),
}));

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it('waits for decoding before displaying the image and copyright', async () => {
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: () => Promise.resolve() });
  let resolveDecode!: () => void;
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(() => new Promise<void>((resolve) => { resolveDecode = resolve; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(<QueryClientProvider client={client}><LoginBackground /></QueryClientProvider>);
  await waitFor(() => expect(resolveDecode).toBeDefined());
  expect(container.querySelector('img')).toBeNull();
  expect(screen.queryByText('今日图片版权')).toBeNull();
  await act(async () => resolveDecode());
  expect(await screen.findByText('今日图片版权')).toBeTruthy();
  expect(container.querySelector('img')?.className).toContain('auth-background-enter');
  expect(localStorage.getItem('login-background-v1')).toContain('today.jpg');
  client.clear();
});
