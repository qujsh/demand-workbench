import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteWorkItems, isPersistedWorkItemNo, saveWorkItem } from './workItemApi';

describe('workItemApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('distinguishes persisted work items from local draft nodes', () => {
    expect(isPersistedWorkItemNo('DEC-ABC123-WORK-001')).toBe(true);
    expect(isPersistedWorkItemNo('work-1791629000000')).toBe(false);
  });

  it('submits selected work item numbers for batch deletion', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        msg: { deletedCount: 2 },
        errorCode: '',
        errorMsg: '',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await deleteWorkItems(['WORK-1', 'SUB-1']);

    expect(result.deletedCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/work-items/delete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ workItemNos: ['WORK-1', 'SUB-1'] }),
      }),
    );
  });
});

describe('saveWorkItem', () => {
  it('creates a child under its persisted parent', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        msg: { id: 'DEC-1-MANUAL-1', type: 'subtask', name: '新增子项', description: '', status: '未开始', role: null, priority: 'high', startDate: null, endDate: null, dependency: null },
        errorCode: '', errorMsg: '',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const saved = await saveWorkItem({
      decompositionNo: 'DEC-1',
      parentWorkItemNo: 'DEC-1-WORK-1',
      isNew: true,
      node: { id: 'local-1', type: 'subtask', name: '新增子项', children: [] },
    });

    expect(saved.id).toBe('DEC-1-MANUAL-1');
    expect(saved).not.toHaveProperty('children');
    expect(saved).not.toHaveProperty('selected');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/v1/work-items/save', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"parentWorkItemNo":"DEC-1-WORK-1"'),
    }));
  });
});
