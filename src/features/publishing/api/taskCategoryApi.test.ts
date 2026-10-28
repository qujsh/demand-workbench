import { afterEach, expect, it, vi } from 'vitest';
import { getManagedTaskCategories, updateTaskCategory } from './taskContentApi';

afterEach(() => vi.unstubAllGlobals());
const category = { code: 'design', name: '设计创意', sortOrder: 20, enabled: false };

it('管理查询支持停用分类、创建来源和创建人，搜索词安全编码', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          msg: [
            {
              ...category,
              source: 'user',
              creatorName: '发布人',
              createdAt: '2026-10-28T12:00:00',
            },
          ],
        }),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  const result = await getManagedTaskCategories('设计&摄影');
  expect(result[0]).toMatchObject({ enabled: false, creatorName: '发布人' });
  expect(fetcher.mock.calls[0][0]).toContain('keyword=' + encodeURIComponent('设计&摄影'));
});
it('改名和停用保留稳定编号，编号只通过Query传递', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true, msg: category })));
  vi.stubGlobal('fetch', fetcher);
  await updateTaskCategory(category);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toContain('/task-categories/update?code=design');
  expect(JSON.parse(options.body)).toEqual({ name: '设计创意', sortOrder: 20, enabled: false });
});
it('后端重名冲突保留业务错误提示', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, errorMsg: '分类名称已存在', errorCode: 'S048105005' }),
          { status: 409 },
        ),
      ),
  );
  await expect(updateTaskCategory(category)).rejects.toMatchObject({ message: '分类名称已存在' });
});
