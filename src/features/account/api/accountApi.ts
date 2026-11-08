import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

const identitySchema = z.object({
  kind: z.enum(['publisher', 'contractor']),
  status: z.string(),
  levelCode: z.string().nullable(),
  levelName: z.string().nullable(),
  growthPoints: z.number(),
  creditScore: z.number(),
  creditRecorded: z.boolean(),
  taskModuleEnabled: z.boolean().default(true),
});
const ledgerSchema = z.object({
  eventNo: z.string(),
  kind: z.enum(['publisher', 'contractor']),
  metric: z.enum(['growth', 'credit']),
  delta: z.number(),
  reason: z.string(),
  createdAt: z.string(),
});
const overviewSchema = z.object({
  role: z.string(),
  roleName: z.string().nullish(),
  roles: z.array(z.string()).optional(),
  roleNames: z.array(z.string()).optional(),
  permissions: z.array(z.string()),
  identities: z.array(identitySchema),
  history: z.array(ledgerSchema),
});
const ruleSchema = z.object({
  kind: z.enum(['publisher', 'contractor']),
  levelCode: z.string(),
  levelName: z.string(),
  sortOrder: z.number(),
  minPoints: z.number().nullable(),
  enabled: z.boolean(),
  version: z.number(),
});
const adminUserSchema = z.object({
  userNo: z.string(),
  memberNo: z.string().nullish(),
  nickname: z.string(),
  status: z.string(),
  role: z.string(),
  roles: z.array(z.string()),
  createdAt: z.string().nullish(),
  lastLoginAt: z.string().nullish(),
});
const auditSchema = z.object({
  id: z.number(),
  operatorNo: z.string(),
  action: z.string(),
  targetNo: z.string(),
  detail: z.string(),
  createdAt: z.string(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AccountFilters = {
  keyword: string;
  role?: string;
  status?: 'active' | 'banned';
  page: number;
  pageSize: number;
};
export const getAdminUserPage = (filters: AccountFilters, signal?: AbortSignal) => {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim());
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  return requestJson(
    `/api/v1/admin/users/page?${params}`,
    apiResponseSchema(
      z.object({
        items: z.array(adminUserSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    ),
    { signal },
  );
};
export type LevelRule = z.infer<typeof ruleSchema>;
export type Adjustment = {
  eventNo: string;
  userNo: string;
  kind: 'publisher' | 'contractor';
  metric: 'growth' | 'credit';
  delta: number;
  reason: string;
};
export const accountKeys = {
  overview: ['account', 'overview'],
  rules: ['account', 'rules'],
  users: ['account', 'users'],
  audits: ['account', 'audits'],
} as const;
export const getOverview = (signal?: AbortSignal) =>
  requestJson('/api/v1/users/identities', apiResponseSchema(overviewSchema), { signal });
export const activateContractor = () =>
  requestJson('/api/v1/users/contractor/activate', apiResponseSchema(overviewSchema), {
    method: 'POST',
  });
export const setTaskModule = (enabled: boolean) =>
  requestJson('/api/v1/users/contractor/module', apiResponseSchema(overviewSchema), {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
export const getRules = (signal?: AbortSignal) =>
  requestJson('/api/v1/users/level-rules', apiResponseSchema(z.array(ruleSchema)), { signal });
export const getAdminUsers = (signal?: AbortSignal) =>
  requestJson('/api/v1/admin/users', apiResponseSchema(z.array(adminUserSchema)), { signal });
export const getAudits = (signal?: AbortSignal) =>
  requestJson('/api/v1/admin/audits', apiResponseSchema(z.array(auditSchema)), { signal });
const post = (path: string, data: unknown) =>
  requestJson(path, apiResponseSchema(z.string()), { method: 'POST', body: JSON.stringify(data) });
export type AdminCommand =
  | { action: 'account'; userNo: string; roles: string[]; status: 'active' | 'banned' }
  | { action: 'role'; userNo: string; roles: string[] }
  | { action: 'status'; userNo: string; status: 'active' | 'banned' }
  | { action: 'rule'; rule: LevelRule }
  | { action: 'adjust'; adjustment: Adjustment };
export function saveAdmin(command: AdminCommand) {
  switch (command.action) {
    case 'account':
      return post('/api/v1/admin/users/save', {
        userNo: command.userNo,
        roles: command.roles,
        status: command.status,
      });
    case 'role':
      return post('/api/v1/admin/users/role/save', {
        userNo: command.userNo,
        roles: command.roles,
      });
    case 'status':
      return post('/api/v1/admin/users/status/save', {
        userNo: command.userNo,
        status: command.status,
      });
    case 'rule':
      return post('/api/v1/admin/level-rules/save', command.rule);
    case 'adjust':
      return post('/api/v1/admin/identities/adjust', command.adjustment);
  }
}
