import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

const identitySchema = z.object({ kind: z.enum(['publisher', 'contractor']), status: z.string(), levelCode: z.string().nullable(), levelName: z.string().nullable(), growthPoints: z.number(), creditScore: z.number(), creditRecorded: z.boolean() });
const ledgerSchema = z.object({ eventNo: z.string(), kind: z.enum(['publisher', 'contractor']), metric: z.enum(['growth', 'credit']), delta: z.number(), reason: z.string(), createdAt: z.string() });
const overviewSchema = z.object({ role: z.string(), permissions: z.array(z.string()), identities: z.array(identitySchema), history: z.array(ledgerSchema) });
const ruleSchema = z.object({ kind: z.enum(['publisher', 'contractor']), levelCode: z.string(), levelName: z.string(), sortOrder: z.number(), minPoints: z.number().nullable(), enabled: z.boolean(), version: z.number() });
const adminUserSchema = z.object({ userNo: z.string(), nickname: z.string(), status: z.string(), role: z.string() });
const auditSchema = z.object({ id: z.number(), operatorNo: z.string(), action: z.string(), targetNo: z.string(), detail: z.string(), createdAt: z.string() });
const memberSchema = z.object({ userNo: z.string(), nickname: z.string(), role: z.enum(['owner', 'manager', 'editor', 'viewer']) });
const spaceSchema = z.object({ requirementNo: z.string(), role: z.enum(['owner', 'manager', 'editor', 'viewer']), members: z.array(memberSchema) });

export type LevelRule = z.infer<typeof ruleSchema>;
export type MemberRole = z.infer<typeof memberSchema>['role'];
export type Adjustment = { eventNo: string; userNo: string; kind: 'publisher' | 'contractor'; metric: 'growth' | 'credit'; delta: number; reason: string };
export const accountKeys = { overview: ['account', 'overview'], rules: ['account', 'rules'], users: ['account', 'users'], audits: ['account', 'audits'] } as const;
export const getOverview = (signal?: AbortSignal) => requestJson('/api/v1/users/identities', apiResponseSchema(overviewSchema), { signal });
export const activateContractor = () => requestJson('/api/v1/users/contractor/activate', apiResponseSchema(overviewSchema), { method: 'POST' });
export const getRules = (signal?: AbortSignal) => requestJson('/api/v1/users/level-rules', apiResponseSchema(z.array(ruleSchema)), { signal });
export const getAdminUsers = (signal?: AbortSignal) => requestJson('/api/v1/admin/users', apiResponseSchema(z.array(adminUserSchema)), { signal });
export const getAudits = (signal?: AbortSignal) => requestJson('/api/v1/admin/audits', apiResponseSchema(z.array(auditSchema)), { signal });
const post = (path: string, data: unknown) => requestJson(path, apiResponseSchema(z.string()), { method: 'POST', body: JSON.stringify(data) });
export type AdminCommand = { action: 'role'; userNo: string; role: string } | { action: 'status'; userNo: string; status: string } | { action: 'rule'; rule: LevelRule } | { action: 'adjust'; adjustment: Adjustment };
export function saveAdmin(command: AdminCommand) {
  switch (command.action) {
    case 'role': return post('/api/v1/admin/users/role/save', { userNo: command.userNo, role: command.role });
    case 'status': return post('/api/v1/admin/users/status/save', { userNo: command.userNo, status: command.status });
    case 'rule': return post('/api/v1/admin/level-rules/save', command.rule);
    case 'adjust': return post('/api/v1/admin/identities/adjust', command.adjustment);
  }
}
export const getMembers = (no: string, signal?: AbortSignal) => requestJson(`/api/v1/requirements/members?requirementNo=${encodeURIComponent(no)}`, apiResponseSchema(spaceSchema), { signal });
export function saveMember(no: string, userNo: string, role: MemberRole | null) {
  return post(`/api/v1/requirements/members/${role === null ? 'remove' : 'save'}?requirementNo=${encodeURIComponent(no)}`, { userNo, ...(role === null ? {} : { role }) });
}
