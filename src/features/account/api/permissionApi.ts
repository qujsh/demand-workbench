import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

export const permissionNodeSchema = z.object({
  code: z.string(), parentCode: z.string().nullable(), nodeType: z.enum(['module', 'action']),
  name: z.string(), nameEn: z.string(), description: z.string(), descriptionEn: z.string(),
  sortOrder: z.number(), enabled: z.boolean(), publicAllowed: z.boolean(), builtIn: z.boolean(), version: z.number(),
});
export type PermissionNode = z.infer<typeof permissionNodeSchema>;
export type PermissionInput = Omit<PermissionNode, 'builtIn'>;
export const permissionKeys = { directory: ['account', 'permission-directory'] } as const;
export const getPermissionDirectory = (signal?: AbortSignal) => requestJson('/api/v1/admin/permissions', apiResponseSchema(z.array(permissionNodeSchema)), { signal });
export const savePermissionNode = (input: PermissionInput, creating: boolean) => requestJson(`/api/v1/admin/permissions/${creating ? 'create' : 'save'}`, apiResponseSchema(z.string()), { method: 'POST', body: JSON.stringify(input) });
