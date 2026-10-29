import { z } from 'zod';
import { requestJson, buildApiUrl, ApiError } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
export const categorySchema = z.object({
  code: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  enabled: z.boolean(),
});
export const projectTaskSchema: z.ZodType<ProjectTask> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(['module', 'feature', 'work', 'subtask']),
    name: z.string(),
    description: z.string().nullable(),
    role: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    children: z.array(projectTaskSchema),
  }),
);
export interface ProjectTask {
  id: string;
  type: 'module' | 'feature' | 'work' | 'subtask';
  name: string;
  description: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  children: ProjectTask[];
}
export const projectSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tasks: z.array(projectTaskSchema),
});
export type PublicProject = z.infer<typeof projectSchema>;
export const rewardItemSchema = z.object({
  type: z.enum(['cash', 'goods', 'service']),
  title: z.string(),
  pricing: z.string().nullable(),
  amountMin: z.number().nullable(),
  amountMax: z.number().nullable(),
  unit: z.string().nullable(),
  quantity: z.number().nullable(),
  condition: z.string().nullable(),
  description: z.string().nullable(),
  handover: z.string().nullable(),
});
export type RewardItem = z.infer<typeof rewardItemSchema>;
export const detailSchema = z.object({
  goal: z.string(),
  collaboration: z.string().nullable(),
  scopeConfirmed: z.boolean(),
  rewards: z.array(rewardItemSchema),
});
export const contentSchema = z.object({
  details: detailSchema.nullable().optional(),
  project: projectSchema.nullable().optional(),
  title: z.string(),
  summary: z.string(),
  categoryCode: z.string(),
  skills: z.array(z.string()),
  cityCode: z.string().nullable(),
  cityName: z.string().nullable(),
  workMode: z.enum(['remote', 'onsite', 'hybrid']),
  rewardType: z.enum([
    'fixed',
    'range',
    'negotiable',
    'non_cash',
    'cash',
    'goods',
    'service',
    'mixed',
  ]),
  amountMin: z.number().nullable(),
  amountMax: z.number().nullable(),
  currency: z.literal('CNY'),
  unit: z.enum(['project', 'hour', 'day', 'time', 'item']),
  budgetText: z.string().nullable(),
  effort: z.number().nullable(),
  effortUnit: z.enum(['hour', 'day']).nullable(),
  newcomer: z.boolean(),
  scope: z.array(z.string()),
  deliverables: z.array(z.string()),
  acceptance: z.array(z.string()),
  startDate: z.string().nullable(),
  deadline: z.string().nullable(),
  mediaNos: z.array(z.string()),
  coverMediaNo: z.string().nullable(),
});
export type PublicContent = z.infer<typeof contentSchema>;
export const getTaskCategories = (signal?: AbortSignal) =>
  requestJson('/api/v1/public/task-categories', apiResponseSchema(z.array(categorySchema)), {
    signal,
  });
export const managedCategorySchema = categorySchema.extend({
  source: z.string(),
  creatorName: z.string().nullable(),
  createdAt: z.string(),
});
export type ManagedCategory = z.infer<typeof managedCategorySchema>;
export const getManagedTaskCategories = (keyword: string, signal?: AbortSignal) =>
  requestJson(
    `/api/v1/task-categories/manage?keyword=${encodeURIComponent(keyword)}`,
    apiResponseSchema(z.array(managedCategorySchema)),
    { signal },
  );
export const updateTaskCategory = (
  category: Pick<ManagedCategory, 'code' | 'name' | 'sortOrder' | 'enabled'>,
) =>
  requestJson(
    `/api/v1/task-categories/update?code=${encodeURIComponent(category.code)}`,
    apiResponseSchema(categorySchema),
    {
      method: 'POST',
      body: JSON.stringify({
        name: category.name,
        sortOrder: category.sortOrder,
        enabled: category.enabled,
      }),
    },
  );
export const createTaskCategory = (code: string, name: string) =>
  requestJson('/api/v1/task-categories/create', apiResponseSchema(categorySchema), {
    method: 'POST',
    body: JSON.stringify({ code, name }),
  });
export const getTaskMediaMetadata = (mediaNo: string, signal?: AbortSignal) =>
  requestJson(
    `/api/v1/task-media/metadata?mediaNo=${encodeURIComponent(mediaNo)}`,
    apiResponseSchema(uploadSchema),
    { signal },
  );
const uploadSchema = z.object({
  mediaNo: z.string(),
  type: z.enum(['image', 'video', 'file']),
  previewUrl: z.string(),
});
export async function uploadTaskMedia(file: File) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(buildApiUrl('/api/v1/task-media/upload'), {
    method: 'POST',
    credentials: 'include',
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success)
    throw new ApiError(payload?.errorMsg || '上传失败', response.status, payload?.errorCode);
  const parsed = apiResponseSchema(uploadSchema).safeParse(payload);
  if (!parsed.success) throw new ApiError('媒体响应格式无效', 502, 'INVALID_API_RESPONSE');
  return parsed.data;
}
