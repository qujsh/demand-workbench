import { afterEach, expect, it, vi } from 'vitest';
import { getAdminUserPage, getOverview, getRules, saveAdmin, setTaskModule } from './accountApi';

afterEach(() => vi.unstubAllGlobals());
const envelope = (msg: unknown) => ({ success: true, msg, errorCode: '', errorMsg: '' });

it('preserves unset thresholds and does not replace them with example values', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          envelope([
            {
              kind: 'contractor',
              levelCode: 'J2',
              levelName: '上造',
              sortOrder: 2,
              minPoints: null,
              enabled: false,
              version: 0,
            },
          ]),
        ),
      ),
    ),
  );
  expect((await getRules())[0].minPoints).toBeNull();
});

it('preserves separate growth and credit with inactive admin permissions', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          envelope({
            role: 'member',
            permissions: [],
            identities: [
              {
                kind: 'contractor',
                status: 'active',
                levelCode: 'J1',
                levelName: '公士',
                growthPoints: 100,
                creditScore: -5,
                creditRecorded: true,
              },
            ],
            history: [],
          }),
        ),
      ),
    ),
  );
  const data = await getOverview();
  expect(data.permissions).toEqual([]);
  expect(data.identities[0]).toMatchObject({ growthPoints: 100, creditScore: -5 });
});

it('keeps an adjustment event number unchanged on a failed request for safe retry', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: false,
        errorCode: 'S048100007',
        errorMsg: '没有执行此操作的权限',
      }),
      { status: 403 },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  const adjustment = {
    eventNo: 'EV-STABLE',
    userNo: 'USER-7',
    kind: 'contractor' as const,
    metric: 'growth' as const,
    delta: 10,
    reason: '人工调整',
  };
  await expect(saveAdmin({ action: 'adjust', adjustment })).rejects.toMatchObject({
    status: 403,
    code: 'S048100007',
  });
  const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(init.body as string).eventNo).toBe('EV-STABLE');
});

it('sends the complete role selection as an array', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope('saved'))));
  vi.stubGlobal('fetch', fetcher);
  await saveAdmin({ action: 'role', userNo: 'USER-7', roles: ['member', 'operator'] });
  const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect(url).toContain('/api/v1/admin/users/role/save');
  expect(JSON.parse(init.body as string)).toEqual({
    userNo: 'USER-7',
    roles: ['member', 'operator'],
  });
});

it('preserves all platform role names and codes in the overview', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          envelope({
            role: 'admin',
            roleName: '平台管理员',
            roles: ['admin', 'operator'],
            roleNames: ['平台管理员', '运营人员'],
            permissions: ['audit.read'],
            identities: [],
            history: [],
          }),
        ),
      ),
    ),
  );
  const data = await getOverview();
  expect(data.roles).toEqual(['admin', 'operator']);
  expect(data.roleNames).toEqual(['平台管理员', '运营人员']);
});

it('passes search filters and server pagination without dropping totals or timestamps', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify(
        envelope({
          items: [
            {
              userNo: 'USER-7',
              nickname: '测试',
              status: 'active',
              role: 'member',
              roles: ['member'],
              createdAt: '2026-11-07T10:00:00',
              lastLoginAt: null,
            },
          ],
          total: 105,
          page: 11,
          pageSize: 10,
        }),
      ),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  const result = await getAdminUserPage({
    keyword: ' 测试_% ',
    role: 'member',
    status: 'active',
    page: 11,
    pageSize: 10,
  });
  const query = new URL(fetcher.mock.calls[0][0] as string, 'http://localhost').searchParams;
  expect(Object.fromEntries(query)).toEqual({
    keyword: '测试_%',
    role: 'member',
    status: 'active',
    page: '11',
    pageSize: '10',
  });
  expect(result.total).toBe(105);
  expect(result.items[0].lastLoginAt).toBeNull();
});

it('submits roles and status together as one account update', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope('saved'))));
  vi.stubGlobal('fetch', fetcher);
  await saveAdmin({
    action: 'account',
    userNo: 'USER-7',
    roles: ['member', 'operator'],
    status: 'banned',
  });
  const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect(url).toContain('/api/v1/admin/users/save');
  expect(JSON.parse(init.body as string)).toEqual({
    userNo: 'USER-7',
    roles: ['member', 'operator'],
    status: 'banned',
  });
});

it('persists module state separately from retained contractor level, growth and credit', async () => {
  const identity = {
    kind: 'contractor',
    status: 'active',
    levelCode: 'J3',
    levelName: '簪袅',
    growthPoints: 250,
    creditScore: -5,
    creditRecorded: true,
    taskModuleEnabled: false,
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify(
          envelope({ role: 'member', permissions: [], identities: [identity], history: [] }),
        ),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  const result = await setTaskModule(false);
  const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect(url).toContain('/api/v1/users/contractor/module');
  expect(JSON.parse(init.body as string)).toEqual({ enabled: false });
  expect(result.identities[0]).toEqual(identity);
});
