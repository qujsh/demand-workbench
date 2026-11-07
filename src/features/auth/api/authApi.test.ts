import { afterEach, expect, it, vi } from 'vitest';
import { getPasswordStatus, loginWithPassword, savePassword, sendLoginCode } from './authApi';

afterEach(() => vi.unstubAllGlobals());
function response(msg: unknown) {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, msg, errorCode: '', errorMsg: '' }) });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
it('keeps phone purpose and session credentials at the API boundary', async () => {
  const fetcher = response({ message: '已发送', retryAfterSeconds: 60 });
  await sendLoginCode('13900000000', 'reset_password');
  expect(fetcher.mock.calls[0][0]).toContain('/auth/sms/send');
  expect(fetcher.mock.calls[0][1].credentials).toBe('include');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ phone: '13900000000', purpose: 'reset_password' });
});
it('sends only required password fields and selects set or reset explicitly', async () => {
  const fetcher = response('密码已设置');
  const values = { phone: '13900000000', code: '654321', password: 'Password123', confirmPassword: 'Password123' };
  await savePassword(values, false);
  await savePassword(values, true);
  expect(fetcher.mock.calls[0][0]).toContain('/auth/password/set');
  expect(fetcher.mock.calls[1][0]).toContain('/auth/password/reset');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ phone: values.phone, code: values.code, password: values.password });
});
it('validates and unwraps password login and private password status responses', async () => {
  const user = { userNo: 'USER-1', nickname: '测试', status: 'active' };
  const fetcher = response(user);
  expect(await loginWithPassword('13900000000', 'Password123')).toEqual(user);
  expect(fetcher.mock.calls[0][0]).toContain('/auth/password/login');
  response({ hasPassword: true });
  expect(await getPasswordStatus()).toEqual({ hasPassword: true });
});
