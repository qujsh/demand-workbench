import { afterEach, expect, it, vi } from 'vitest';
import { getRoleConfiguration, saveRoleConfiguration } from './roleApi';

const envelope = (msg: unknown) => ({ success: true, msg, errorCode: '', errorMsg: '' });
afterEach(() => vi.unstubAllGlobals());
it('preserves Chinese labels and common eligibility separately from stable codes', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          envelope({
            permissions: [
              {
                code: 'roles.manage',
                name: '管理角色与权限',
                group: '系统配置',
                description: '配置授权',
                publicAllowed: false,
              },
            ],
            roles: [
              {
                code: 'role_custom',
                name: '审核人员',
                description: '',
                enabled: true,
                version: 3,
                builtIn: false,
                common: false,
                permissions: ['audit.read'],
              },
            ],
          }),
        ),
      ),
    ),
  );
  const configuration = await getRoleConfiguration();
  expect(configuration.permissions[0]).toMatchObject({
    code: 'roles.manage',
    name: '管理角色与权限',
    publicAllowed: false,
  });
  expect(configuration.roles[0]).toMatchObject({
    code: 'role_custom',
    name: '审核人员',
    version: 3,
  });
});
it('submits the version and preserves custom role codes when saving', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope('role_custom'))));
  vi.stubGlobal('fetch', fetcher);
  await saveRoleConfiguration({
    code: 'role_custom',
    name: '分类查看员',
    description: '',
    enabled: true,
    version: 7,
    permissions: ['categories.read'],
  });
  const [path, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect(path).toContain('/api/v1/admin/roles/save');
  expect(JSON.parse(init.body as string)).toMatchObject({
    code: 'role_custom',
    version: 7,
    permissions: ['categories.read'],
  });
});
it('surfaces stale configuration as a conflict instead of reporting success', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'S048100010',
          errorMsg: '记录已经变化，请刷新后重试',
        }),
        { status: 409 },
      ),
    ),
  );
  await expect(
    saveRoleConfiguration({
      code: 'public',
      name: '公共权限',
      description: '',
      enabled: true,
      version: 0,
      permissions: [],
    }),
  ).rejects.toMatchObject({ status: 409, code: 'S048100010' });
});
