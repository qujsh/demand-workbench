import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

export const permissionNodeSchema = z.object({
  code: z.string(), parentCode: z.string().nullable(), nodeType: z.enum(['module', 'group', 'page', 'action', 'common']),
  name: z.string(), nameEn: z.string(), description: z.string(), descriptionEn: z.string(),
  visible: z.boolean().optional(), sortOrder: z.number(), enabled: z.boolean(), publicAllowed: z.boolean(), builtIn: z.boolean(), version: z.number(),
});
export type PermissionNode = z.infer<typeof permissionNodeSchema>;
export type PermissionInput = Omit<PermissionNode, 'builtIn'>;
export const permissionKeys = { directory: ['account', 'permission-directory'] } as const;
export const getPermissionDirectory = (signal?: AbortSignal) => requestJson('/api/v1/admin/permissions', apiResponseSchema(z.array(permissionNodeSchema)), { signal });
export const savePermissionNode = (input: PermissionInput, creating: boolean) => requestJson(`/api/v1/admin/permissions/${creating ? 'create' : 'save'}`, apiResponseSchema(z.string()), { method: 'POST', body: JSON.stringify(input) });

export type PermissionOrder = Pick<PermissionNode, 'code' | 'sortOrder' | 'version'>;
export const reorderPermissions = (items: PermissionOrder[]) => requestJson('/api/v1/admin/permissions/reorder', apiResponseSchema(z.string()), { method: 'POST', body: JSON.stringify({ items }) });
export type NavigationNode = { code: string; name: string; nameEn: string; nodeType: 'group' | 'page'; children: NavigationNode[] };
const navigationSchema: z.ZodType<NavigationNode> = z.lazy(() => z.object({ code: z.string(), name: z.string(), nameEn: z.string(), nodeType: z.enum(['group', 'page']), children: z.array(navigationSchema) }));
export const getNavigation = (signal?: AbortSignal) => requestJson('/api/v1/users/navigation', apiResponseSchema(z.array(navigationSchema)), { signal });
