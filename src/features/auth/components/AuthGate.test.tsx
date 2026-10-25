import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthGate } from './AuthGate';
import { useAuth } from '../authContext';
import { getCurrentUser, login, logout, sendLoginCode, sessionsKey } from '../api/authApi';

vi.mock('../api/authApi', () => ({
  currentUserKey: ['auth', 'current-user'], sessionsKey: ['auth', 'sessions'],
  getCurrentUser: vi.fn(), login: vi.fn(), logout: vi.fn(), sendLoginCode: vi.fn(),
}));
vi.mock('./LoginBackground', () => ({ LoginBackground: () => null }));

afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

function UserView() {
  const { user, logout: exit } = useAuth();
  return <><span>{user.nickname}</span><button onClick={() => void exit()}>退出测试账号</button></>;
}

it('allows immediate re-login and clears previous account sessions despite fresh cache', async () => {
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({
    matches: false, media, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
  vi.mocked(getCurrentUser).mockResolvedValueOnce({ userNo: 'USER-A', nickname: '账号甲', status: 'active' })
    .mockResolvedValueOnce({ userNo: 'USER-B', nickname: '账号乙', status: 'active' });
  vi.mocked(logout).mockResolvedValue(undefined);
  vi.mocked(sendLoginCode).mockResolvedValue(undefined);
  vi.mocked(login).mockResolvedValue({ userNo: 'USER-B', nickname: '账号乙', status: 'active' });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
  client.setQueryData(sessionsKey, ['账号甲的设备']);
  render(<QueryClientProvider client={client}><AuthGate><UserView /></AuthGate></QueryClientProvider>);
  await screen.findByText('账号甲');
  fireEvent.click(screen.getByRole('button', { name: '退出测试账号' }));
  await screen.findByRole('button', { name: '获取验证码' });
  expect(client.getQueryData(sessionsKey)).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
  fireEvent.change(await screen.findByRole('textbox', { name: '验证码' }), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: '登 录' }));
  await waitFor(() => expect(screen.getByText('账号乙')).toBeTruthy());
  expect(getCurrentUser).toHaveBeenCalledTimes(2);
  client.clear();
});
