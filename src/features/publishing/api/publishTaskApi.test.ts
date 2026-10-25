import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPublishTask, savePublishTask } from './publishTaskApi';

describe('publishTaskApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saves a draft without duplicating decomposition work item relations', async () => {
    const response = {
      taskNo: 'TASK-000001', requirementNo: 'REQ-1', decompositionNo: 'DEC-1', status: 'draft', title: '任务', category: '分类',
      summary: '', skills: '', experience: '不限', recruitCount: 1, priceModel: '固定价格',
      budget: '', startDate: null, deadline: null, workMode: '待定', recruitMode: '报名审核',
      visibility: '所有人可见', publishedAt: null,
    } as const;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, msg: response, errorCode: '', errorMsg: '' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await savePublishTask('REQ-1', {
      status: 'draft', title: '任务', category: '分类', summary: '', skills: '', experience: '不限',
      recruitCount: 1, priceModel: '固定价格', budget: '', startDate: null, deadline: null,
      workMode: '待定', recruitMode: '报名审核', visibility: '所有人可见',
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({ status: 'draft' });
    expect(JSON.parse(request.body as string)).not.toHaveProperty('workItemNos');
  });

  it('cancels a published task through the dedicated endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      msg: {
        taskNo: 'TASK-000001', requirementNo: 'REQ-1', decompositionNo: 'DEC-1',
        status: 'cancelled', title: '任务', category: '', summary: '简介', skills: '',
        experience: '不限', recruitCount: 1, priceModel: '固定价格', budget: '',
        startDate: null, deadline: null, workMode: '待定', recruitMode: '报名审核',
        visibility: '所有人可见', publishedAt: '2026-10-13T16:00:00',
      },
      errorCode: '', errorMsg: '',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await cancelPublishTask('REQ-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/requirements/publish-task/cancel?requirementNo=REQ-1',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
