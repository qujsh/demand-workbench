import type { PermissionNode } from './api/permissionApi';
export const resourceNames: Record<PermissionNode['nodeType'], string> = { module: '类目', group: '类目', page: '页面', action: '权限', common: '通用权限' };
export const isMenuGroup = (node: PermissionNode) => node.nodeType === 'group' || node.nodeType === 'module';
