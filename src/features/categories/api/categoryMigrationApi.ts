import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
export const categoryMigrationSchema = z.object({
  migrationNo: z.string(),
  sourceCode: z.string(),
  sourceName: z.string(),
  targetCode: z.string().nullable(),
  targetName: z.string().nullable(),
  actorName: z.string().nullable(),
  taskCount: z.number(),
  createdAt: z.string(),
});
export type CategoryMigration = z.infer<typeof categoryMigrationSchema>;
export const getCategoryUsage = (code: string, signal?: AbortSignal) =>
  requestJson(
    `/api/v1/task-categories/usage?code=${encodeURIComponent(code)}`,
    apiResponseSchema(z.number()),
    { signal },
  );
export const deleteCategory = (code: string, targetCode: string | null) =>
  requestJson(
    `/api/v1/task-categories/delete?code=${encodeURIComponent(code)}`,
    apiResponseSchema(z.string()),
    { method: 'POST', body: JSON.stringify({ targetCode }) },
  );
export const getCategoryMigrations = (keyword: string, signal?: AbortSignal) =>
  requestJson(
    `/api/v1/task-categories/migrations?keyword=${encodeURIComponent(keyword)}`,
    apiResponseSchema(z.array(categoryMigrationSchema)),
    { signal },
  );
export const getCategoryMigrationTasks = (migrationNo: string, signal?: AbortSignal) =>
  requestJson(
    `/api/v1/task-categories/migration-tasks?migrationNo=${encodeURIComponent(migrationNo)}`,
    apiResponseSchema(
      z.array(
        z.object({
          taskNo: z.string(),
          taskTitle: z.string(),
          formalChanged: z.boolean(),
          draftChanged: z.boolean(),
        }),
      ),
    ),
    { signal },
  );
