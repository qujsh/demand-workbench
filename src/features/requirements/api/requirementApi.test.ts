import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Requirement } from '../../../shared/types/workItem';
import {
  deleteRequirement,
  isPersistedRequirement,
  saveRequirement,
} from './requirementApi';

const requirement: Requirement = {
  id: 'REQ-024',
  title: '开发一套预约服务系统',
  description: '用户描述',
  aiDescription: 'AI 描述',
  updated: '刚刚',
  stage: '草稿',
  modules: 3,
  items: 13,
  currentDecompositionNo: 'DEC-001',
};

describe('requirementApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('distinguishes backend numbers from demo numbers', () => {
    expect(isPersistedRequirement('REQ-KFYTYY-000025')).toBe(true);
    expect(isPersistedRequirement('REQ-024')).toBe(false);
  });

  it('creates a demo requirement and maps the publishing payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        msg: {
          requirementNo: 'REQ-KFYTYY-000025',
          title: requirement.title,
          userDescription: requirement.description,
          aiDescription: requirement.aiDescription,
          stage: 'draft',
          currentDecompositionNo: 'DEC-001',
          createdAt: '2026-10-12T16:00:00',
          updatedAt: '2026-10-12T16:00:00',
          moduleCount: 3,
          workItemCount: 13,
          attachments: [],
        },
        errorCode: '',
        errorMsg: '',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await saveRequirement({ requirement });

    expect(result.requirementNo).toBe('REQ-KFYTYY-000025');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/requirements/save',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual(
      expect.objectContaining({
        stage: 'draft',
        currentDecompositionNo: 'DEC-001',
        attachments: [],
      }),
    );
  });

  it('uses the requirement number query when updating persisted data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        msg: {
          requirementNo: 'REQ-KFYTYY-000025',
          title: requirement.title,
          userDescription: '',
          aiDescription: '',
          stage: 'draft',
          currentDecompositionNo: null,
          createdAt: '2026-10-12T16:00:00',
          updatedAt: '2026-10-12T16:00:00',
          moduleCount: 0,
          workItemCount: 0,
          attachments: [],
        },
        errorCode: '',
        errorMsg: '',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await saveRequirement({ requirement: { ...requirement, id: 'REQ-KFYTYY-000025' } });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/requirements/save?requirementNo=REQ-KFYTYY-000025',
      expect.any(Object),
    );
  });

  it('reports an API version mismatch instead of a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          msg: {
            requirementNo: 'REQ-KFYTYY-000025',
            currentDecompositionId: 'DEC-001',
          },
        }),
      }),
    );

    await expect(saveRequirement({ requirement })).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      message: '请求已提交，但后端响应格式与当前前端版本不一致，请重启后端服务后重试',
    });
  });

  it('soft deletes a requirement using its business number', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, msg: 'deleted', errorCode: '', errorMsg: '' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await deleteRequirement('REQ-KFYTYY-000025');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/requirements/delete?requirementNo=REQ-KFYTYY-000025',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
