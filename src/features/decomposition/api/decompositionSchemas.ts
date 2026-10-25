import { z } from 'zod';
import type { WorkItemNode, WorkItemPriority } from '../../../shared/types/workItem';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

const prioritySchema = z
  .enum(['unset', 'low', 'medium', 'high', '高', '中', '低', ''])
  .nullish()
  .transform((value): WorkItemPriority => {
    if (value === 'high') return '高';
    if (value === 'medium') return '中';
    if (value === 'low') return '低';
    if (value === 'unset' || value == null) return '';
    return value;
  });

export const workItemNodeSchema: z.ZodType<WorkItemNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(['module', 'feature', 'work', 'subtask']),
    name: z.string(),
    description: z.string().nullish().transform(value => value ?? ''),
    status: z.enum(['未开始', '待开发', '进行中', '待验收', '已完成']).nullish().transform(value => value ?? '未开始'),
    role: z.string().nullish().transform(value => value ?? '未分配'),
    priority: prioritySchema,
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    dependency: z.string().nullish().transform(value => value ?? ''),
    selected: z.boolean().optional().default(false),
    children: z.array(workItemNodeSchema).optional().default([]),
  }),
);

export const submitResponseSchema = z.object({
  taskId: z.string(),
  status: z.string(),
  message: z.string(),
});

export const decompositionTaskSchema = z.object({
  taskId: z.string(),
  status: z
    .enum(['queued', 'processing', 'success', 'failed', 'QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED'])
    .transform(status => status.toUpperCase() as 'QUEUED' | 'PROCESSING' | 'SUCCESS' | 'FAILED'),
  stage: z.string(),
  message: z.string(),
  summary: z
    .object({
      moduleCount: z.number(),
      featureCount: z.number(),
      workItemCount: z.number(),
      subtaskCount: z.number(),
    })
    .nullable(),
  modules: z.array(workItemNodeSchema),
  errorCode: z.string().nullable(),
  createdAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const submitApiResponseSchema = apiResponseSchema(submitResponseSchema);
export const decompositionApiResponseSchema = apiResponseSchema(decompositionTaskSchema);

export type SubmitResponse = z.infer<typeof submitResponseSchema>;
export type DecompositionTask = z.infer<typeof decompositionTaskSchema>;
