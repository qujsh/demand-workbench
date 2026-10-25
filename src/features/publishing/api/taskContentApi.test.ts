import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTaskCategory, uploadTaskMedia } from './taskContentApi';
import { getPublishTask, savePublishTask, getPublishVersions } from './publishTaskApi';
afterEach(() => vi.unstubAllGlobals());
const response = (msg: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      success: status === 200,
      msg,
      errorCode: status === 409 ? 'S048102010' : '',
      errorMsg: '正式版本已更新',
    }),
    { status },
  );
describe('unified publishing contracts', () => {
  it('accepts a first-time task without a saved draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null)));
    expect(await getPublishTask('REQ-1')).toBeNull();
  });
  it('creates shared categories through the authenticated API', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response({ code: 'cat_1', name: '新分类', sortOrder: 1000, enabled: true }),
      );
    vi.stubGlobal('fetch', fetcher);
    expect((await createTaskCategory('新分类')).code).toBe('cat_1');
    expect(fetcher.mock.calls[0][0]).toContain('/task-categories/create');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ name: '新分类' });
  });
  it('uses multipart for media and keeps authentication', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ mediaNo: 'MEDIA-1', type: 'image', previewUrl: '/preview' }));
    vi.stubGlobal('fetch', fetcher);
    await uploadTaskMedia(new File(['x'], 'image.png', { type: 'image/png' }));
    expect(fetcher.mock.calls[0][1].body).toBeInstanceOf(FormData);
    expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
    expect(fetcher.mock.calls[0][1].credentials).toBe('include');
  });
  it('preserves version conflicts instead of reporting success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, 409)));
    await expect(
      savePublishTask('REQ-1', {
        status: 'draft',
        title: '标题',
        category: 'design',
        summary: '简介',
        skills: '',
        experience: '不限',
        recruitCount: 1,
        priceModel: '固定价格',
        budget: '',
        startDate: null,
        deadline: null,
        workMode: '远程',
        recruitMode: '报名审核',
        visibility: '所有人可见',
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'S048102010' });
  });
  it('reads immutable history through the requirement-scoped route', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response([{ version: 1, title: 'V1', publishedAt: '2026-10-25T12:00:00' }]),
      );
    vi.stubGlobal('fetch', fetcher);
    expect((await getPublishVersions('REQ-1'))[0]?.version).toBe(1);
    expect(fetcher.mock.calls[0][0]).toContain('/publish-task/versions?requirementNo=REQ-1');
  });
});
