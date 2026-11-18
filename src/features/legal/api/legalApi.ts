import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
const documentSchema = z.object({
  id: z.number(),
  kind: z.enum(['TERMS', 'PRIVACY']),
  version: z.number().nullable(),
  revision: z.number(),
  html: z.string(),
  contentHash: z.string(),
  publisherId: z.number().nullable(),
  publishedAt: z.string().nullable(),
});
const acceptanceSchema = z.object({
  id: z.number(),
  eventNo: z.string(),
  userNo: z.string(),
  termsId: z.number(),
  termsVersion: z.number(),
  privacyId: z.number(),
  privacyVersion: z.number(),
  loginMethod: z.string(),
  acceptedAt: z.string(),
});
export type LegalDocument = z.infer<typeof documentSchema>;
export type LegalKind = LegalDocument['kind'];
const base = '/api/v1/b/legal';
export const legalApi = {
  list: (kind: LegalKind, before: string, signal?: AbortSignal) =>
    requestJson(
      `${base}/documents?${new URLSearchParams({ kind, before })}`,
      apiResponseSchema(z.array(documentSchema)),
      { signal },
    ),
  detail: (id: number, signal?: AbortSignal) =>
    requestJson(`${base}/document?id=${id}`, apiResponseSchema(documentSchema), { signal }),
  save: (kind: LegalKind, html: string, id?: number, revision = 0) =>
    requestJson(`${base}/save${id ? `?id=${id}` : ''}`, apiResponseSchema(documentSchema), {
      method: 'POST',
      body: JSON.stringify({ kind, html, revision }),
    }),
  publish: (id: number, revision: number) =>
    requestJson(`${base}/publish?id=${id}`, apiResponseSchema(documentSchema), {
      method: 'POST',
      body: JSON.stringify({ revision }),
    }),
  acceptances: (userNo: string, before: string, signal?: AbortSignal) =>
    requestJson(
      `${base}/acceptances?${new URLSearchParams({ userNo, before })}`,
      apiResponseSchema(z.array(acceptanceSchema)),
      { signal },
    ),
};
