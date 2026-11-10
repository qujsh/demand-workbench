import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthGate } from './AuthGate';
import { useAuth } from '../authContext';
import { ApiError } from '../../../shared/api/httpClient';
import {
  getCurrentUser,
  login,
  loginWithPassword,
  logout,
  savePassword,
  sendLoginCode,
  sessionsKey,
} from '../api/authApi';

vi.mock('../api/authApi', () => ({
  currentUserKey: ['auth', 'current-user'],
  sessionsKey: ['auth', 'sessions'],
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  loginWithPassword: vi.fn(),
  logout: vi.fn(),
  sendLoginCode: vi.fn(),
  savePassword: vi.fn(),
}));
vi.mock('./LoginBackground', () => ({ LoginBackground: () => null }));

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.mocked(getCurrentUser).mockRejectedValue(new ApiError('请先登录', 401));
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function UserView() {
  const { user, logout: exit } = useAuth();
  return (
    <>
      <span>{user.nickname}</span>
      <button onClick={() => void exit()}>退出测试账号</button>
    </>
  );
}
function mount(path = '/shares') {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthGate>
          <UserView />
        </AuthGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
it('defaults to password login with SMS, forgot and first password entries', async () => {
  const client = mount();
  await screen.findByLabelText('密码');
  expect(screen.getByLabelText('手机号').getAttribute('value')).toBe('');
  expect(screen.getByRole('link', { name: '忘记密码？' }).getAttribute('href')).toBe(
    '/password/forgot',
  );
  expect(screen.getByRole('link', { name: '设置登录密码' }).getAttribute('href')).toBe(
    '/password/set',
  );
  fireEvent.click(screen.getByRole('link', { name: '验证码登录' }));
  await screen.findByLabelText('短信验证码');
  expect(screen.queryByText('123456')).toBeNull();
  expect(sendLoginCode).not.toHaveBeenCalled();
  client.clear();
});
it('clears previous account cache and allows a new password login', async () => {
  vi.mocked(getCurrentUser)
    .mockResolvedValueOnce({ userNo: 'USER-A', nickname: '账号甲', status: 'active' })
    .mockResolvedValueOnce({ userNo: 'USER-B', nickname: '账号乙', status: 'active' });
  vi.mocked(logout).mockResolvedValue(undefined);
  vi.mocked(loginWithPassword).mockResolvedValue({
    userNo: 'USER-B',
    nickname: '账号乙',
    status: 'active',
  });
  const client = mount();
  client.setQueryData(sessionsKey, ['账号甲的设备']);
  await screen.findByText('账号甲');
  fireEvent.click(screen.getByRole('button', { name: '退出测试账号' }));
  await screen.findByLabelText('密码');
  expect(client.getQueryData(sessionsKey)).toBeUndefined();
  fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13900000000' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Valid12345' } });
  fireEvent.click(screen.getByRole('button', { name: '登 录' }));
  await screen.findByText('账号乙');
  expect(loginWithPassword).toHaveBeenCalledWith('13900000000', 'Valid12345');
  client.clear();
});
it('sends login-purpose code with cooldown and logs in via SMS', async () => {
  vi.mocked(sendLoginCode).mockResolvedValue(undefined);
  vi.mocked(login).mockResolvedValue({ userNo: 'USER-B', nickname: '账号乙', status: 'active' });
  const client = mount('/login/sms');
  fireEvent.change(await screen.findByLabelText('手机号'), { target: { value: '13900000000' } });
  fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
  const cooldown = await screen.findByRole('button', { name: /秒后重发/ });
  expect(cooldown.hasAttribute('disabled')).toBe(true);
  expect(sendLoginCode).toHaveBeenCalledWith('13900000000', 'login');
  fireEvent.change(screen.getByLabelText('短信验证码'), { target: { value: '654321' } });
  vi.mocked(getCurrentUser).mockResolvedValue({
    userNo: 'USER-B',
    nickname: '账号乙',
    status: 'active',
  });
  fireEvent.click(screen.getByRole('button', { name: '登 录' }));
  await screen.findByText('账号乙');
  expect(login).toHaveBeenCalledWith('13900000000', '654321');
  client.clear();
});
it('validates confirmation and uses a dedicated set-password verification purpose', async () => {
  vi.mocked(sendLoginCode).mockResolvedValue(undefined);
  vi.mocked(savePassword).mockResolvedValue(undefined);
  const client = mount('/password/set');
  fireEvent.change(await screen.findByLabelText('手机号'), { target: { value: '13900000000' } });
  fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
  await waitFor(() => expect(sendLoginCode).toHaveBeenCalledWith('13900000000', 'set_password'));
  fireEvent.change(screen.getByLabelText('短信验证码'), { target: { value: '654321' } });
  fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: 'Valid12345' } });
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'Different123' } });
  fireEvent.click(screen.getByRole('button', { name: '确认设置密码' }));
  await screen.findByText('两次输入的密码不一致');
  expect(savePassword).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'Valid12345' } });
  fireEvent.click(screen.getByRole('button', { name: '确认设置密码' }));
  await screen.findByText('登录密码已设置');
  expect(savePassword).toHaveBeenCalledWith(
    expect.objectContaining({ phone: '13900000000', code: '654321', password: 'Valid12345' }),
    false,
  );
  client.clear();
});
it('surfaces send failures without starting cooldown', async () => {
  vi.mocked(sendLoginCode).mockRejectedValue(new ApiError('短信服务尚未配置，请联系管理员', 503));
  const client = mount('/password/forgot');
  fireEvent.change(await screen.findByLabelText('手机号'), { target: { value: '13900000000' } });
  fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
  await screen.findByText('短信服务尚未配置，请联系管理员');
  expect(screen.getByRole('button', { name: '获取验证码' }).hasAttribute('disabled')).toBe(false);
  expect(sendLoginCode).toHaveBeenCalledWith('13900000000', 'reset_password');
  client.clear();
});
