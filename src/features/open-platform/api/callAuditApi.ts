import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
const callAuditSchema = z.object({
  requestNo: z.string(),
  userNo: z.string().nullable(),
  nickname: z.string().nullable(),
  keyNo: z.string(),
  keyName: z.string(),
  method: z.string(),
  tool: z.string().nullable(),
  resourceNo: z.string().nullable(),
  outcome: z.enum(['running', 'success', 'error']),
  errorCode: z.string().nullable(),
  durationMs: z.number(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type CallAudit = z.infer<typeof callAuditSchema>;
export type CallAuditFilters = {
  scope: 'self' | 'all';
  userNo?: string;
  keyNo?: string;
  method?: string;
  tool?: string;
  outcome?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};
export function listCallAudits(filters: CallAuditFilters, signal?: AbortSignal) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return requestJson(
    `/api/v1/open-platform/call-audits?${params}`,
    apiResponseSchema(
      z.object({
        records: z.array(callAuditSchema),
        total: z.number(),
        successCount: z.number(),
        errorCount: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    ),
    { signal },
  );
}
