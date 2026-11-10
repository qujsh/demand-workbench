import { Tag, Tooltip } from 'antd';
import { EyeOff } from 'lucide-react';
import type { PermissionNode } from '../api/permissionApi';

/** 展示资源自身的开关状态，隐藏导航与停用权限分别标识。 */
export function PermissionResourceStatus({ node }: { node: PermissionNode }) {
  return (
    <>
      {node.nodeType === 'page' && node.visible === false && (
        <Tooltip title="菜单隐藏：仅隐藏左侧菜单入口，不撤销授权；能否访问仍取决于启用状态和账号权限。">
          <Tag color="orange" aria-label="菜单隐藏" icon={<EyeOff size={12} />} />
        </Tooltip>
      )}
    </>
  );
}
