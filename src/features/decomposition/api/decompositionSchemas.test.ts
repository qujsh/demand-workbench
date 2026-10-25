import { describe, expect, it } from 'vitest';
import {
  decompositionApiResponseSchema,
  decompositionTaskSchema,
  submitApiResponseSchema,
} from './decompositionSchemas';

describe('decompositionTaskSchema', () => {
  it('校验并补全工作项树默认字段', () => {
    const result = decompositionTaskSchema.parse({
      taskId: 'DEC-001',
      status: 'SUCCESS',
      stage: 'COMPLETED',
      message: '工作项拆解完成',
      summary: { moduleCount: 1, featureCount: 0, workItemCount: 0, subtaskCount: 0 },
      modules: [{ id: 'MOD-001', type: 'module', name: '用户模块' }],
      errorCode: null,
      createdAt: '2026-10-11T10:00:00',
      completedAt: '2026-10-11T10:00:10',
    });

    expect(result.modules[0].children).toEqual([]);
    expect(result.modules[0].selected).toBe(false);
  });

  it('拒绝未知工作项类型', () => {
    expect(() =>
      decompositionTaskSchema.parse({
        taskId: 'DEC-001',
        status: 'SUCCESS',
        stage: 'COMPLETED',
        message: '完成',
        summary: null,
        modules: [{ id: 'X-1', type: 'unknown', name: '未知节点' }],
        errorCode: null,
        createdAt: null,
        completedAt: null,
      }),
    ).toThrow();
  });

  it('解包后端统一响应并转换任务状态和优先级', () => {
    const result = decompositionApiResponseSchema.parse({
      success: true,
      msg: {
        taskId: 'DEC-001',
        status: 'success',
        stage: 'completed',
        message: '工作项拆解完成',
        summary: { moduleCount: 1, featureCount: 1, workItemCount: 1, subtaskCount: 0 },
        modules: [
          {
            id: 'DEC-001-MODULE-001',
            type: 'module',
            name: '用户模块',
            priority: 'high',
            children: [],
          },
        ],
        errorCode: null,
        createdAt: '2026-10-12T08:00:00',
        completedAt: '2026-10-12T08:00:10',
      },
      errorCode: '',
      errorMsg: '',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.modules[0].priority).toBe('高');
  });

  it('解包提交任务响应', () => {
    const result = submitApiResponseSchema.parse({
      success: true,
      msg: { taskId: 'DEC-001', status: 'queued', message: '拆解任务已提交' },
      errorCode: '',
      errorMsg: '',
    });

    expect(result.taskId).toBe('DEC-001');
  });

  it('拒绝统一响应中的业务失败', () => {
    expect(() =>
      decompositionApiResponseSchema.parse({
        success: false,
        msg: null,
        errorCode: 'S048101002',
        errorMsg: '拆解任务不存在',
      }),
    ).toThrow('拆解任务不存在');
  });
});
