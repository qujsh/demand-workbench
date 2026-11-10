import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
export const categorySchema = z.object({
  code: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  enabled: z.boolean(),
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
  category: Pick<ManagedCategory, 'code' | 'name' | 'sortOrder' | 'enabled'> & {
    originalCode?: string;
  },
) =>
  requestJson(
    `/api/v1/task-categories/update?code=${encodeURIComponent(category.originalCode ?? category.code)}`,
    apiResponseSchema(categorySchema),
    {
      method: 'POST',
      body: JSON.stringify({
        code: category.code,
        name: category.name,
        sortOrder: category.sortOrder,
        enabled: category.enabled,
      }),
    },
  );
export const createTaskCategory = (code: string, name: string, sortOrder = 1000, enabled = true) =>
  requestJson('/api/v1/task-categories/create', apiResponseSchema(categorySchema), {
    method: 'POST',
    body: JSON.stringify({ code, name, sortOrder, enabled }),
  });
