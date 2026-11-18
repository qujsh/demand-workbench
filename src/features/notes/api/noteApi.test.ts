import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getNote,
  listNotes,
  saveNote,
  getFloating,
  mergeTags,
  getTagMergeTask,
  retryTagMergeTask,
  getNoteReviews,
  retryNoteReview,
} from './noteApi';

const envelope = (msg: unknown) => ({ success: true, msg, errorCode: '', errorMsg: '' });
const document = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '#成长 新内容' }] }],
};
const input = {
  title: '编辑草稿',
  document,
  documentSchemaVersion: 1,
  occurredAt: '2020-05-01T09:00:00+08:00',
  occurredTimezone: 'Asia/Shanghai',
  visibility: 'PRIVATE',
  mediaNos: ['MEDIA-own'],
};
const detail = {
  recordNo: 'SHARE-one',
  title: '正式内容',
  bodyText: '原文',
  bodyExcerpt: '原文',
  occurredAt: input.occurredAt,
  updatedAt: input.occurredAt,
  deletedAt: null,
  status: 'SAVED',
  visibility: 'PUBLIC',
  version: 3,
  tags: [],
  images: [],
  imageCount: 0,
  draftKind: null,
  document: { type: 'doc' },
  documentSchemaVersion: 1,
  workingCopy: {
    draftVersion: 2,
    baseVersion: 3,
    updatedAt: input.occurredAt,
    payload: input,
    bodyText: '#成长 新内容',
    tagNos: [],
  },
};
afterEach(() => vi.unstubAllGlobals());
describe('笔记API持久化边界', () => {
  it('查看保留正式内容，编辑恢复独立草稿和媒体编号', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(envelope(detail)), { status: 200 })),
    );
    expect((await getNote('SHARE-one')).title).toBe('正式内容');
    const copy = await getNote('SHARE-one', true);
    expect(copy.title).toBe('编辑草稿');
    expect(copy.draftVersion).toBe(2);
    expect(copy.mediaNos).toEqual(['MEDIA-own']);
    expect(copy.images[0]).toContain('mediaNo=MEDIA-own');
  });
  it('保存带版本且只发送媒体编号，不发送派生标签与图片地址', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            envelope({ recordNo: 'SHARE-one', version: 4, status: 'SAVED', draftVersion: null }),
          ),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    await saveNote({
      id: 'SHARE-one',
      title: '标题',
      body: '正文',
      date: '2020-05-01T09:00',
      tags: ['成长'],
      visibility: 'private',
      images: ['http://example.invalid'],
      mediaNos: ['MEDIA-own'],
      version: 3,
      draftVersion: 2,
      document,
      referenceNos: ['SHARE-source'],
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('records/save?recordNo=SHARE-one');
    const body = JSON.parse(String(init.body));
    expect(body.expectedVersion).toBe(3);
    expect(body.expectedDraftVersion).toBe(2);
    expect(body.record.mediaNos).toEqual(['MEDIA-own']);
    expect(body.record.referenceNos).toEqual(['SHARE-source']);
    expect(body.record.tags).toBeUndefined();
    expect(body.record.images).toBeUndefined();
  });
  it('地点随正式内容和编辑草稿分别恢复，保存时允许清除', async () => {
    const location = {
      name: '西湖',
      address: '杭州市西湖区',
      city: '杭州',
      poiId: 'B-test',
      longitude: 120.14,
      latitude: 30.25,
    };
    const fetch = vi.fn(
      async (_url: string, init?: RequestInit) =>
        new Response(
          JSON.stringify(
            envelope(
              init?.method === 'POST'
                ? { recordNo: 'SHARE-one', version: 4, status: 'SAVED', draftVersion: null }
                : {
                    ...detail,
                    location,
                    workingCopy: { ...detail.workingCopy, payload: { ...input, location: null } },
                  },
            ),
          ),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const formal = await getNote('SHARE-one');
    expect(formal.location).toEqual(location);
    const copy = await getNote('SHARE-one', true);
    expect(copy.location).toBeNull();
    await saveNote(formal);
    expect(JSON.parse(String(fetch.mock.calls.at(-1)?.[1]?.body)).record.location).toEqual(
      location,
    );
    await saveNote({ ...formal, location: null });
    expect(JSON.parse(String(fetch.mock.calls.at(-1)?.[1]?.body)).record.location).toBeNull();
  });
  it('定位后的向上游标请求保留日期与筛选上下文', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            envelope({
              items: [],
              matchedCount: 0,
              nextCursor: null,
              previousCursor: 'newer-cursor',
              hasMore: false,
              anchorRecordNo: null,
              exactDate: false,
            }),
          ),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await listNotes(
      {
        status: 'SAVED',
        keyword: '',
        tagNo: '',
        visibility: '',
        period: '',
        anchorDate: '2022-05-01',
      },
      'boundary',
      undefined,
      'newer',
    );
    const url = new URL(
      String((fetch.mock.calls as unknown as [string][])[0]?.[0]),
      'http://localhost',
    );
    expect(url.searchParams.get('anchorDate')).toBe('2022-05-01');
    expect(url.searchParams.get('direction')).toBe('newer');
    expect(url.searchParams.get('cursor')).toBe('boundary');
    expect(result.previousCursor).toBe('newer-cursor');
  });
  it('持久浮窗列表能解析数据库的不可用标志', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              envelope([{ recordNo: 'SHARE-one', title: null, occurredAt: null, unavailable: 1 }]),
            ),
            { status: 200 },
          ),
      ),
    );
    expect((await getFloating())[0]?.unavailable).toBe(true);
  });
  it('响应不合法明确报告协议不一致', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(envelope({ items: [] })), { status: 200 })),
    );
    await expect(
      listNotes({ status: 'SAVED', keyword: '', tagNo: '', visibility: '', period: '' }, ''),
    ).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });
  it('并发冲突保留后端稳定错误码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ errorCode: 'S048107002', errorMsg: '已被修改' }), {
            status: 409,
          }),
      ),
    );
    await expect(getNote('SHARE-one')).rejects.toMatchObject({ status: 409, code: 'S048107002' });
  });
});

describe('回收站历史记录兼容', () => {
  const historicalReview = {
    taskNo: null, status: 'approved', completedCount: 0, totalCount: 0,
    message: '旧展示数据未执行审核', policyVersion: 'local-preview-fixture-v1',
  };
  const filters = { status: 'TRASH' as const, keyword: '', tagNo: '', visibility: '', period: '' };
  const trashed = { ...detail, deletedAt: '2026-11-11T15:34:34Z', review: historicalReview };
  const page = (record: unknown) => ({ items: [record], matchedCount: 1, hasMore: false, nextCursor: null });
  it('有内容的回收站能读取无真实审核任务的历史记录，并保留恢复所需编号和版本', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(envelope(page(trashed)))));
    vi.stubGlobal('fetch', fetcher);
    const result = await listNotes(filters, '');
    expect(result.matchedCount).toBe(1);
    expect(result.items[0]).toMatchObject({ id: detail.recordNo, deleted: true, version: 3,
      timelineDate: trashed.deletedAt, review: null, visibility: 'public' });
  });
  it.each(['queued', 'running', 'failed'])('无任务编号和任务数的%s记录仍报告协议错误', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(envelope(page({
      ...trashed, review: { ...historicalReview, status },
    }))))));
    await expect(listNotes(filters, '')).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });
  it('历史展示元数据不能混入真实审核任务列表', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(envelope([historicalReview])))));
    await expect(getNoteReviews()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });
});

describe('异步标签合并协议', () => {
  const task = {
    taskNo: 'MERGE-one',
    sourceTagNo: 'TAG-source',
    targetTagNo: 'TAG-target',
    sourceName: '拍摄',
    targetName: '摄影',
    status: 'RUNNING',
    totalCount: 1000,
    processedCount: 300,
    progress: 30,
    errorMsg: null,
  };
  it('提交返回可轮询任务，标签编号位于 Query', async () => {
    const fetcher = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(envelope(task)), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetcher);
    expect(await mergeTags('TAG-source', 'TAG-target', 7)).toEqual(task);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain('/tags/merge?sourceTagNo=TAG-source&targetTagNo=TAG-target');
    expect(JSON.parse(String(init?.body))).toEqual({ expectedOrderVersion: 7 });
  });
  it('刷新后可读取进度，首次没有任务时返回 null', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope({ task: null }))))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope({ task }))));
    vi.stubGlobal('fetch', fetcher);
    expect((await getTagMergeTask()).task).toBeNull();
    expect((await getTagMergeTask()).task?.processedCount).toBe(300);
  });
  it('重试使用任务编号，保留服务端断点，并传播标签锁定错误', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope({ ...task, status: 'QUEUED' }))))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            msg: null,
            errorCode: 'S048107005',
            errorMsg: '标签正在合并，暂不可修改标签',
          }),
          { status: 409 },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    expect((await retryTagMergeTask('MERGE-one')).processedCount).toBe(300);
    expect(fetcher.mock.calls[0][0]).toContain('/tags/merge-task/retry?taskNo=MERGE-one');
    await expect(mergeTags('TAG-source', 'TAG-target', 7)).rejects.toThrow('标签正在合并');
  });
});

it('待审核记录按实际私密展示，编辑时恢复公开申请，审核重试编号仅通过Query传递', async () => {
  const review = {
    taskNo: 'REVIEW-test',
    status: 'queued',
    completedCount: 0,
    totalCount: 2,
    message: '',
    policyVersion: 'v1',
  };
  const fetch = vi.fn(
    async (url: string | URL | Request) =>
      new Response(
        JSON.stringify(
          envelope(
            String(url).includes('/reviews')
              ? [review]
              : String(url).includes('/retry')
                ? review
                : {
                    ...detail,
                    visibility: 'PRIVATE',
                    requestedVisibility: 'PUBLIC',
                    review,
                    workingCopy: null,
                  },
          ),
        ),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const shown = await getNote('SHARE-one');
  expect(shown.visibility).toBe('private');
  expect(shown.review?.status).toBe('queued');
  expect((await getNote('SHARE-one', true)).visibility).toBe('public');
  expect(await getNoteReviews()).toEqual([review]);
  await retryNoteReview(shown);
  expect(String(fetch.mock.calls.at(-1)?.[0])).toContain(
    'records/review/retry?recordNo=SHARE-one&taskNo=REVIEW-test',
  );
});
