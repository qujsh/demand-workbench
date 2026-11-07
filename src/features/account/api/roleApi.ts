import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

const permissionSchema = z.object({ code: z.string(), name: z.string(), group: z.string(), description: z.string(), publicAllowed: z.boolean(), nameEn: z.string().optional(), descriptionEn: z.string().optional(), path: z.array(z.object({ code: z.string(), name: z.string(), nameEn: z.string() })).optional() });
const roleSchema = z.object({ code: z.string(), name: z.string(), description: z.string(), enabled: z.boolean(), version: z.number(), builtIn: z.boolean(), common: z.boolean(), permissions: z.array(z.string()) });
const configurationSchema = z.object({ permissions: z.array(permissionSchema), roles: z.array(roleSchema) });
export type PermissionDefinition = z.infer<typeof permissionSchema>;
export type PlatformRole = z.infer<typeof roleSchema>;
export type RoleInput = Pick<PlatformRole, 'name' | 'description' | 'enabled' | 'version' | 'permissions'> & { code: string | null };
export const roleKeys = { configuration: ['account', 'role-configuration'], options: ['account', 'role-options'] } as const;
export const getRoleConfiguration = (signal?: AbortSignal) => requestJson('/api/v1/admin/roles', apiResponseSchema(configurationSchema), { signal });
export const getRoleOptions = (signal?: AbortSignal) => requestJson('/api/v1/admin/roles/options', apiResponseSchema(z.array(roleSchema)), { signal });
export const saveRoleConfiguration = (input: RoleInput) => requestJson('/api/v1/admin/roles/save', apiResponseSchema(z.string()), { method: 'POST', body: JSON.stringify(input) });
