import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

export const keyScopeSchema = z.enum(['shares:read', 'shares:write']);
export const apiKeySchema = z.object({
  keyNo: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(keyScopeSchema),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
});
export type KeyScope = z.infer<typeof keyScopeSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type CreateKey = { name: string; scopes: KeyScope[]; validDays: number };
export const apiKeyQueryKey = ['open-platform', 'keys'] as const;
export const listApiKeys = (signal?: AbortSignal) =>
  requestJson('/api/v1/open-platform/keys', apiResponseSchema(z.array(apiKeySchema)), { signal });
export const createApiKey = (data: CreateKey) =>
  requestJson(
    '/api/v1/open-platform/keys/create',
    apiResponseSchema(z.object({ key: apiKeySchema, secret: z.string() })),
    { method: 'POST', body: JSON.stringify(data) },
  );
export const revokeApiKey = (keyNo: string) =>
  requestJson(
    `/api/v1/open-platform/keys/revoke?keyNo=${encodeURIComponent(keyNo)}`,
    apiResponseSchema(z.string()),
    { method: 'POST' },
  );
