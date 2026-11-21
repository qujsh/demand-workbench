import { noteLocationSchema } from './amapSdk';
import { z } from 'zod';
import dayjs from 'dayjs';
import { buildApiUrl, requestJson, ApiError } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
import type { NoteRecord } from '../noteModels';

const tagSchema = z.object({
  tagNo: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  recordCount: z.number(),
});
const imageSchema = z.object({
  mediaNo: z.string(),
  contentUrl: z.string(),
  mimeType: z.string(),
  size: z.number(),
});
const documentSchema = z.object({ type: z.literal('doc') }).passthrough();
const referenceSchema = z.object({
  recordNo: z.string(),
  title: z.string().nullable(),
  occurredAt: z.string().nullable(),
  unavailable: z.boolean(),
});
const inputSchema = z.object({
  location: noteLocationSchema.nullable().optional(),
  title: z.string().nullable(),
  document: documentSchema,
  documentSchemaVersion: z.literal(1),
  occurredAt: z.string(),
  occurredTimezone: z.string(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']),
  mediaNos: z.array(z.string()),
  referenceNos: z.array(z.string()).default([]),
});
export const noteReviewSchema = z.object({
  taskNo: z.string(),
  status: z.enum([
    'queued',
    'running',
    'approved',
    'rejected',
    'review_required',
    'failed',
    'cancelled',
  ]),
  completedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  message: z.string(),
  policyVersion: z.string(),
});
/** 历史展示数据只带公开状态，没有实际审核任务；不作为可轮询或重试的任务。 */
const recordReviewSchema = z.union([
  noteReviewSchema,
  z
    .object({
      taskNo: z.null(),
      status: z.literal('approved'),
      completedCount: z.literal(0),
      totalCount: z.literal(0),
      message: z.string(),
      policyVersion: z.string(),
    })
    .transform(() => null),
]);
const summarySchema = z.object({
  location: noteLocationSchema.nullable().optional(),
  review: recordReviewSchema.nullable().default(null),
  requestedVisibility: z.enum(['PRIVATE', 'PUBLIC']).optional(),
  recordNo: z.string(),
  title: z.string().nullable(),
  bodyText: z.string(),
  bodyExcerpt: z.string(),
  occurredAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  status: z.enum(['DRAFT', 'SAVED']),
  visibility: z.enum(['PRIVATE', 'PUBLIC']),
  version: z.number(),
  tags: z.array(tagSchema),
  images: z.array(imageSchema),
  imageCount: z.number(),
  draftKind: z.enum(['NEW_RECORD', 'EDIT_COPY']).nullable(),
});
const detailSchema = summarySchema.extend({
  referenceNos: z.array(z.string()).default([]),
  references: z.array(referenceSchema).default([]),
  workingReferences: z.array(referenceSchema).default([]),
  document: documentSchema,
  documentSchemaVersion: z.literal(1),
  workingCopy: z
    .object({
      draftVersion: z.number(),
      baseVersion: z.number(),
      updatedAt: z.string(),
      payload: inputSchema,
      bodyText: z.string(),
      tagNos: z.array(z.string()),
    })
    .nullable(),
});
export const noteTagsSchema = z.object({
  paths: z.array(z.object({ name: z.string(), recordCount: z.number() })).default([]),
  orderVersion: z.number(),
  tags: z.array(tagSchema),
  recordCount: z.number(),
});
export type NoteTagsResult = z.infer<typeof noteTagsSchema>;
export type NoteFilters = {
  status: 'SAVED' | 'DRAFT' | 'TRASH';
  keyword: string;
  tagNo: string;
  tagPath?: string;
  visibility: string;
  period: string;
  anchorDate?: string;
};
function query(values: Record<string, string>) {
  return new URLSearchParams(Object.entries(values).filter(([, value]) => value)).toString();
}
function post<T>(path: string, schema: z.ZodType<T>, body: unknown) {
  return requestJson(`/api/v1/notes/${path}`, apiResponseSchema(schema), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export function toNoteRecord(value: z.infer<typeof summarySchema>): NoteRecord {
  return {
    id: value.recordNo,
    location: value.location ?? null,
    review: value.review,
    requestedVisibility:
      (value.requestedVisibility ?? value.visibility) === 'PUBLIC' ? 'public' : 'private',
    title: value.title ?? '',
    body: value.bodyText,
    date: dayjs(value.occurredAt).format('YYYY-MM-DDTHH:mm'),
    tags: value.tags.map((tag) => tag.name),
    visibility: value.visibility === 'PUBLIC' ? 'public' : 'private',
    images: value.images.map((image) => buildApiUrl(image.contentUrl)),
    mediaNos: value.images.map((image) => image.mediaNo),
    imageCount: value.imageCount,
    draft: value.status === 'DRAFT' || value.draftKind === 'EDIT_COPY',
    deleted: value.deletedAt !== null,
    version: value.version,
    timelineDate: value.deletedAt ?? (value.draftKind ? value.updatedAt : value.occurredAt),
  };
}
export async function listNotes(
  filters: NoteFilters,
  cursor: string,
  signal?: AbortSignal,
  direction = 'older',
) {
  const result = await requestJson(
    `/api/v1/notes/records?${query({ ...filters, direction, cursor, pageSize: '20' })}`,
    apiResponseSchema(
      z.object({
        items: z.array(summarySchema),
        matchedCount: z.number(),
        hasMore: z.boolean(),
        nextCursor: z.string().nullable(),
        previousCursor: z.string().nullable().optional(),
        anchorRecordNo: z.string().nullable().optional(),
        exactDate: z.boolean().optional(),
      }),
    ),
    { signal },
  );
  return { ...result, items: result.items.map(toNoteRecord) };
}
export function getTags(signal?: AbortSignal) {
  return requestJson('/api/v1/notes/tags', apiResponseSchema(noteTagsSchema), { signal });
}
export function getPeriods(status: string, signal?: AbortSignal) {
  return requestJson(
    `/api/v1/notes/records/periods?${query({ status })}`,
    apiResponseSchema(
      z.object({ years: z.array(z.object({ year: z.string(), months: z.array(z.string()) })) }),
    ),
    { signal },
  );
}
export async function getNote(id: string, editing = false): Promise<NoteRecord> {
  const value = await requestJson(
    `/api/v1/notes/records/detail?${query({ recordNo: id })}`,
    apiResponseSchema(detailSchema),
  );
  const result = {
    ...toNoteRecord(value),
    document: value.document,
    referenceNos: value.referenceNos,
    references: value.references,
    draftVersion: value.workingCopy?.draftVersion ?? null,
  };
  if (!editing) return result;
  result.visibility =
    (value.requestedVisibility ?? value.visibility) === 'PUBLIC' ? 'public' : 'private';
  if (!value.workingCopy) return result;
  const copy = value.workingCopy;
  return {
    ...result,
    location: copy.payload.location ?? null,
    title: copy.payload.title ?? '',
    body: copy.bodyText,
    document: copy.payload.document,
    date: dayjs(copy.payload.occurredAt).format('YYYY-MM-DDTHH:mm'),
    visibility: copy.payload.visibility === 'PUBLIC' ? 'public' : 'private',
    mediaNos: copy.payload.mediaNos,
    referenceNos: copy.payload.referenceNos,
    references: value.workingReferences,
    images: copy.payload.mediaNos.map((no) =>
      buildApiUrl(`/api/v1/notes/media/content?mediaNo=${encodeURIComponent(no)}`),
    ),
    draft: true,
  };
}
export function saveNote(record: NoteRecord) {
  const body = {
    clientRequestNo: record.id,
    expectedVersion: record.version,
    expectedDraftVersion: record.draftVersion ?? null,
    action: record.draft ? 'DRAFT' : 'SAVE',
    record: {
      location: record.location ?? null,
      title: record.title || null,
      document: record.document,
      documentSchemaVersion: 1,
      occurredAt: dayjs(record.date).format('YYYY-MM-DDTHH:mm:ssZ'),
      occurredTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      visibility: record.visibility.toUpperCase(),
      mediaNos: record.mediaNos ?? [],
      referenceNos: record.referenceNos ?? [],
    },
  };
  return post(
    record.version ? `records/save?${query({ recordNo: record.id })}` : 'records/create',
    z.object({
      recordNo: z.string(),
      version: z.number(),
      status: z.string(),
      draftVersion: z.number().nullable(),
    }),
    body,
  );
}
export function getTrashPreview(signal?: AbortSignal) {
  return requestJson(
    '/api/v1/notes/records/trash-preview',
    apiResponseSchema(
      z.object({
        recordCount: z.number().int().nonnegative(),
        fingerprint: z.string(),
      }),
    ),
    { signal },
  );
}
export function emptyTrash(expectedFingerprint: string) {
  return post(
    'records/empty-trash',
    z.object({
      clearedRecordCount: z.number(),
      imageCleanupQueuedCount: z.number(),
    }),
    { expectedFingerprint },
  );
}
export function purgeNote(record: NoteRecord) {
  return post(
    `records/purge?${query({ recordNo: record.id })}`,
    z.object({
      recordNo: z.string(),
      purged: z.literal(true),
      imageCleanupQueuedCount: z.number(),
      retainedSharedImageCount: z.number(),
    }),
    { expectedVersion: record.version },
  );
}
export function changeRecord(record: NoteRecord, restore: boolean) {
  return post(
    `records/${restore ? 'restore' : 'trash'}?${query({ recordNo: record.id })}`,
    z.object({ recordNo: z.string(), version: z.number() }),
    { expectedVersion: record.version },
  );
}
export function addTag(name: string, expectedOrderVersion: number) {
  return post(
    'tags/create',
    z.object({
      tag: tagSchema,
      created: z.boolean(),
      restored: z.boolean(),
      orderVersion: z.number(),
    }),
    { name, expectedOrderVersion },
  );
}
export function reorderTags(tagNos: string[], expectedOrderVersion: number) {
  return post('tags/reorder', z.object({ orderVersion: z.number() }), {
    tagNos,
    expectedOrderVersion,
  });
}
const tagMergeJobSchema = z.object({
  taskNo: z.string(),
  sourceTagNo: z.string(),
  targetTagNo: z.string(),
  sourceName: z.string(),
  targetName: z.string(),
  status: z.enum(['QUEUED', 'PREPARING', 'RUNNING', 'FINALIZING', 'COMPLETED', 'FAILED']),
  totalCount: z.number(),
  processedCount: z.number(),
  progress: z.number(),
  errorMsg: z.string().nullable(),
});
export type TagMergeJob = z.infer<typeof tagMergeJobSchema>;
export function getTagMergeTask(signal?: AbortSignal) {
  return requestJson(
    '/api/v1/notes/tags/merge-task',
    apiResponseSchema(z.object({ task: tagMergeJobSchema.nullable() })),
    { signal },
  );
}
export function retryTagMergeTask(taskNo: string) {
  return post(`tags/merge-task/retry?${query({ taskNo })}`, tagMergeJobSchema, {});
}
export function mergeTags(sourceTagNo: string, targetTagNo: string, expectedOrderVersion: number) {
  return post(`tags/merge?${query({ sourceTagNo, targetTagNo })}`, tagMergeJobSchema, {
    expectedOrderVersion,
  });
}
export const tagDeleteImpactSchema = z.object({
  tagNo: z.string(),
  name: z.string(),
  orderVersion: z.number(),
  affectedRecordCount: z.number(),
  savedRecordCount: z.number(),
  draftRecordCount: z.number(),
});
export type TagDeleteImpact = z.infer<typeof tagDeleteImpactSchema>;
export function getTagDeleteImpact(tagNo: string, signal?: AbortSignal) {
  return requestJson(
    `/api/v1/notes/tags/delete-preview?${query({ tagNo })}`,
    apiResponseSchema(tagDeleteImpactSchema),
    { signal },
  );
}
export function deleteTag(
  tagNo: string,
  expectedOrderVersion: number,
  expectedRecordCount?: number,
) {
  return post(
    `tags/${expectedRecordCount === undefined ? 'delete' : 'delete-with-records'}?${query({ tagNo })}`,
    z.object({ tagNo: z.string(), orderVersion: z.number(), affectedRecordCount: z.number() }),
    { expectedOrderVersion, ...(expectedRecordCount === undefined ? {} : { expectedRecordCount }) },
  );
}
export async function uploadNoteImage(file: File) {
  const ticket = await post(
    'media/upload-token',
    z.object({
      mediaNo: z.string(),
      token: z.string(),
      key: z.string(),
      uploadUrl: z.url().refine((value) => new URL(value).protocol === 'https:'),
    }),
    { scene: 'note_image', filename: file.name, mimeType: file.type, size: file.size },
  );
  const body = new FormData();
  body.append('file', file);
  body.append('token', ticket.token);
  body.append('key', ticket.key);
  const response = await fetch(ticket.uploadUrl, { method: 'POST', body, credentials: 'omit' });
  const uploaded = z
    .object({ key: z.literal(ticket.key) })
    .safeParse(await response.json().catch(() => null));
  if (!response.ok || !uploaded.success)
    throw new ApiError('图片上传失败，请重试', response.status, 'SHARE_UPLOAD_FAILED');
  const media = await post(`media/complete?${query({ mediaNo: ticket.mediaNo })}`, imageSchema, {});
  return { ...media, src: buildApiUrl(media.contentUrl) };
}

export const floatingSchema = z.object({
  recordNo: z.string(),
  title: z.string().nullable(),
  occurredAt: z.string().nullable(),
  unavailable: z.union([z.boolean(), z.number()]).transform((value) => Boolean(value)),
});
export function getFloating(signal?: AbortSignal) {
  return requestJson('/api/v1/notes/floating', apiResponseSchema(z.array(floatingSchema)), {
    signal,
  });
}
export function saveFloating(recordNo: string, remove = false) {
  return post(
    `floating/save?${query({ recordNo, remove: String(remove) })}`,
    z.object({ recordNo: z.string() }),
    {},
  );
}

export function getNoteReviews(signal?: AbortSignal) {
  return requestJson(
    '/api/v1/notes/records/reviews',
    apiResponseSchema(z.array(noteReviewSchema)),
    { signal },
  );
}
export function retryNoteReview(record: NoteRecord) {
  if (!record.review) throw new Error('审核申请不存在');
  return post(
    `records/review/retry?${query({ recordNo: record.id, taskNo: record.review.taskNo })}`,
    noteReviewSchema,
    {},
  );
}
