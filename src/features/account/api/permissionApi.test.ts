import { afterEach, expect, it, vi } from 'vitest';
import { getPermissionDirectory, savePermissionNode, type PermissionInput } from './permissionApi';
const envelope = (msg: unknown) => ({ success: true, msg, errorCode: '', errorMsg: '' });
afterEach(() => vi.unstubAllGlobals());
const input: PermissionInput = { code: 'assignments.read', parentCode: 'assignments', nodeType: 'action', name: '查看承接', nameEn: 'View Assignments', description: '中文说明', descriptionEn: 'English description', sortOrder: 10, enabled: true, publicAllowed: false, version: 3 };
it('round trips bilingual directory fields and stable node hierarchy', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope([{ ...input, builtIn: false }])))));
  expect(await getPermissionDirectory()).toEqual([{ ...input, builtIn: false }]);
});
it('distinguishes creation from versioned editing and propagates conflicts', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(envelope(input.code)))));
  vi.stubGlobal('fetch', fetcher);
  await savePermissionNode(input, true);
  await savePermissionNode(input, false);
  expect(fetcher.mock.calls[0][0]).toContain('/admin/permissions/create');
  expect(fetcher.mock.calls[1][0]).toContain('/admin/permissions/save');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(input);
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, errorCode: 'S048100010', errorMsg: '版本冲突' }), { status: 409 }));
  await expect(savePermissionNode(input, false)).rejects.toMatchObject({ status: 409, code: 'S048100010' });
});
it('rejects invalid directory payloads instead of displaying incomplete permissions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope([{ code: 'missing-fields' }])))));
  await expect(getPermissionDirectory()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
});
