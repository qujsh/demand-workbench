import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiKey, listApiKeys, revokeApiKey } from './apiKeyApi';

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
const success = (msg: unknown) =>
  new Response(JSON.stringify({ success: true, msg, errorCode: '', errorMsg: '' }), {
    status: 200,
  });
afterEach(() => vi.unstubAllGlobals());
describe('API密钥契约', () => {
  it('读取脱敏列表，并验证权限范围', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(success([key])));
    expect(await listApiKeys()).toEqual([key]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(success([{ ...key, scopes: ['admin'] }])));
    await expect(listApiKeys()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });
  it('创建时返回一次明文，撤销使用Query编号', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(success({ key, secret: 'one-time-secret' }))
      .mockResolvedValueOnce(success('已撤销'));
    vi.stubGlobal('fetch', fetch);
    const command = { name: 'Codex', scopes: ['shares:read'] as const, validDays: 90 };
    expect((await createApiKey({ ...command, scopes: [...command.scopes] })).secret).toBe(
      'one-time-secret',
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(command);
    await revokeApiKey('KEY/a');
    expect(fetch.mock.calls[1][0]).toContain('revoke?keyNo=KEY%2Fa');
  });
  it('展示后端的权限错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ errorMsg: '没有权限', errorCode: 'S048109003' }), {
            status: 403,
          }),
        ),
    );
    await expect(listApiKeys()).rejects.toMatchObject({ status: 403, message: '没有权限' });
  });
});
