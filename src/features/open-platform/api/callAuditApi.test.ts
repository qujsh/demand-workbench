import { afterEach, expect, it, vi } from 'vitest';
import { listCallAudits } from './callAuditApi';
afterEach(() => vi.unstubAllGlobals());
it('审计查询绑定范围、分页与筛选，拒绝不符合契约的数据', async () => {
  const data = { records: [], total: 0, successCount: 0, errorCount: 0, page: 2, pageSize: 20 };
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true, msg: data })));
  vi.stubGlobal('fetch', fetch);
  expect(
    await listCallAudits({
      scope: 'self',
      keyNo: 'KEY-a',
      tool: 'create_share',
      page: 2,
      pageSize: 20,
    }),
  ).toEqual(data);
  expect(fetch.mock.calls[0][0]).toContain(
    'scope=self&keyNo=KEY-a&tool=create_share&page=2&pageSize=20',
  );
  fetch.mockResolvedValue(
    new Response(JSON.stringify({ success: true, msg: { ...data, records: [{}] } })),
  );
  await expect(listCallAudits({ scope: 'self', page: 1, pageSize: 20 })).rejects.toMatchObject({
    code: 'INVALID_API_RESPONSE',
  });
});
