/** 业务代码注册页面绑定；权限管理只配置菜单名称、层级和授权，不接收任意路由或图标代码。 */
export const navigationBindings: Record<string, { target: string; icon: string }> = {
  'dashboard.view': { target: 'dashboard', icon: 'LayoutDashboard' },
  'requirements.use': { target: 'requirements', icon: 'Inbox' },
  'shares.use': { target: 'shares', icon: 'Pencil' },
  'assignments.view': { target: 'talent', icon: 'Users' },
  'deliveries.view': { target: 'delivery', icon: 'ClipboardCheck' },
  'categories.read': { target: 'categories', icon: 'ListFilter' },
  'settings.view': { target: 'system/settings', icon: 'UserRound' },
  'call-audits.view': { target: 'system/call-audits', icon: 'History' },
  'api-keys.view': { target: 'system/api-keys', icon: 'ShieldCheck' },
  'accounts.manage': { target: 'system/accounts', icon: 'Users' },
  'roles.manage': { target: 'system/roles', icon: 'ShieldCheck' },
  'permissions.manage': { target: 'system/permissions', icon: 'KeyRound' },
  'growth.manage': { target: 'system/growth', icon: 'TrendingUp' },
  'audit.read': { target: 'system/audits', icon: 'History' },
};
