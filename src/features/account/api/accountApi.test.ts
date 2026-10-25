import { afterEach, expect, it, vi } from 'vitest';
import { getOverview, getRules, saveAdmin } from './accountApi';

afterEach(() => vi.unstubAllGlobals());
const envelope = (msg: unknown) => ({ success: true, msg, errorCode: '', errorMsg: '' });

it('preserves unset thresholds and does not replace them with example values', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope([{ kind: 'contractor', levelCode: 'J2', levelName: '上造', sortOrder: 2, minPoints: null, enabled: false, version: 0 }])))));
  expect((await getRules())[0].minPoints).toBeNull();
});

it('preserves separate growth and credit with inactive admin permissions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope({ role: 'member', permissions: [], identities: [{ kind: 'contractor', status: 'active', levelCode: 'J1', levelName: '公士', growthPoints: 100, creditScore: -5, creditRecorded: true }], history: [] })))));
  const data = await getOverview();
  expect(data.permissions).toEqual([]);
  expect(data.identities[0]).toMatchObject({ growthPoints: 100, creditScore: -5 });
});

it('keeps an adjustment event number unchanged on a failed request for safe retry', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, errorCode: 'S048100007', errorMsg: '没有执行此操作的权限' }), { status: 403 }));
  vi.stubGlobal('fetch', fetcher);
  const adjustment = { eventNo: 'EV-STABLE', userNo: 'USER-7', kind: 'contractor' as const, metric: 'growth' as const, delta: 10, reason: '人工调整' };
  await expect(saveAdmin({ action: 'adjust', adjustment })).rejects.toMatchObject({ status: 403, code: 'S048100007' });
  const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(init.body as string).eventNo).toBe('EV-STABLE');
});
