import { z } from 'zod';
import { contentSchema } from './taskContentApi';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
import { requestJson } from '../../../shared/api/httpClient';

export const publishTaskSchema = z.object({
  taskNo: z.string(),
  requirementNo: z.string(),
  decompositionNo: z.string().nullable(),
  status: z.enum(['draft', 'published', 'cancelled']),
  title: z.string(),
  category: z.string(),
  summary: z.string(),
  skills: z.string(),
  experience: z.string(),
  recruitCount: z.number(),
  priceModel: z.string(),
  budget: z.string(),
  startDate: z.string().nullable(),
  deadline: z.string().nullable(),
  workMode: z.string(),
  recruitMode: z.string(),
  visibility: z.string(),
  publishedAt: z.string().nullable(),
  content: contentSchema.nullable().optional(),
  invitedUserNos: z.array(z.string()).optional(),
  version: z.number().optional(),
  hasDraft: z.boolean().optional(),
});

const responseSchema = apiResponseSchema(publishTaskSchema);
const nullableResponseSchema = z
  .object({ success: z.literal(true), msg: publishTaskSchema.nullable() })
  .transform((value) => value.msg);

export type PublishTask = z.infer<typeof publishTaskSchema>;
export type PublishTaskInput = Omit<
  PublishTask,
  'taskNo' | 'requirementNo' | 'decompositionNo' | 'publishedAt' | 'hasDraft'
>;

export function getPublishTask(requirementNo: string, signal?: AbortSignal) {
  return requestJson(
    `/api/v1/requirements/publish-task?requirementNo=${encodeURIComponent(requirementNo)}`,
    nullableResponseSchema,
    { signal },
  );
}

export function savePublishTask(requirementNo: string, input: PublishTaskInput) {
  return requestJson(
    `/api/v1/requirements/publish-task/save?requirementNo=${encodeURIComponent(requirementNo)}`,
    responseSchema,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function discardPublishDraft(requirementNo: string) {
  return requestJson(
    `/api/v1/requirements/publish-task/discard-draft?requirementNo=${encodeURIComponent(requirementNo)}`,
    nullableResponseSchema,
    { method: 'POST' },
  );
}

export function cancelPublishTask(requirementNo: string) {
  return requestJson(
    `/api/v1/requirements/publish-task/cancel?requirementNo=${encodeURIComponent(requirementNo)}`,
    responseSchema,
    { method: 'POST' },
  );
}

export const getPublishVersions = (no: string, signal?: AbortSignal) =>
  requestJson(
    `/api/v1/requirements/publish-task/versions?requirementNo=${encodeURIComponent(no)}`,
    apiResponseSchema(
      z.array(z.object({ version: z.number(), title: z.string(), publishedAt: z.string() })),
    ),
    { signal },
  );
export const getPublishVersion = (no: string, version: number, signal?: AbortSignal) =>
  requestJson(
    `/api/v1/requirements/publish-task/version?requirementNo=${encodeURIComponent(no)}&version=${version}`,
    responseSchema,
    { signal },
  );
