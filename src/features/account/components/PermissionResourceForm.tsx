import { Alert, Button, Checkbox, Form, Input, Select, Switch, Tag } from 'antd';
import type { PermissionInput, PermissionNode } from '../api/permissionApi';

import { isMenuGroup, resourceNames } from '../permissionResources';
import { PermissionResourceStatus } from './PermissionResourceStatus';
type Props = {
  node: PermissionNode;
  creating: boolean;
  catalog: PermissionNode[];
  pending: boolean;
  error?: string;
  onSave: (input: PermissionInput) => Promise<void>;
  onCancel: () => void;
};

/** 菜单元数据由代码绑定；此处只维护名称、授权层级和开关。 */
export function PermissionResourceForm({
  node,
  creating,
  catalog,
  pending,
  error,
  onSave,
  onCancel,
}: Props) {
  const [form] = Form.useForm<PermissionInput>();
  const group = isMenuGroup(node);
  const page = node.nodeType === 'page';
  const common = node.nodeType === 'common';
  const protectedEntry =
    ['accounts.manage', 'roles.manage', 'permissions.manage'].includes(node.code) && !creating;
  const excluded = new Set([node.code]);
  for (let i = 0; i < catalog.length; i++)
    for (const item of catalog)
      if (item.parentCode && excluded.has(item.parentCode)) excluded.add(item.code);
  const parents = catalog.filter(
    (item) =>
      !excluded.has(item.code) &&
      (node.nodeType === 'action' ? item.nodeType === 'page' : isMenuGroup(item)),
  );
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ ...node, visible: node.visible ?? true }}
      onFinish={(values) => {
        void onSave({
          ...node,
          ...values,
          code: creating ? values.code : node.code,
          nodeType: node.nodeType,
          parentCode: common ? null : values.parentCode || null,
          publicAllowed: !group && !!values.publicAllowed,
        }).catch(() => undefined);
      }}
    >
      <div className="permission-resource-heading">
        <h2>{creating ? `新增${resourceNames[node.nodeType]}` : node.name}</h2>
        <span className="permission-resource-status">
          <Tag title={!creating && !node.enabled ? '已停用' : undefined}>
            {resourceNames[node.nodeType]}
          </Tag>
          {!creating && <PermissionResourceStatus node={node} />}
        </span>
      </div>
      {protectedEntry && (
        <Alert showIcon type="info" title="此管理入口受保护，不可停用、隐藏或设为公共权限。" />
      )}
      <div className="permission-resource-fields">
        <Form.Item
          name="name"
          label="中文名称"
          rules={[{ required: true, whitespace: true, message: '请输入中文名称' }]}
        >
          <Input aria-label="中文名称" maxLength={80} />
        </Form.Item>
        <Form.Item
          name="nameEn"
          label="英文名称"
          rules={[{ required: true, whitespace: true, message: '请输入英文名称' }]}
        >
          <Input aria-label="英文名称" maxLength={120} />
        </Form.Item>
        <Form.Item
          className="permission-resource-full"
          name="code"
          label={group ? '资源编码' : '权限编码'}
          extra={
            group
              ? '类目只组织菜单层级，不参与角色授权。'
              : '英文编码用于前后端鉴权绑定，创建后不可修改。'
          }
          rules={[
            { required: true, message: '请输入英文编码' },
            {
              pattern: /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/,
              message: '使用小写英文、数字及点、下划线或连字符',
            },
          ]}
        >
          <Input aria-label="英文编码" disabled={!creating} maxLength={64} />
        </Form.Item>
        {!common && (
          <Form.Item
            className="permission-resource-full"
            name="parentCode"
            label={node.nodeType === 'action' ? '所属页面' : '所属类目'}
            rules={[{ required: node.nodeType === 'action', message: '请选择所属页面' }]}
          >
            <Select
              aria-label={node.nodeType === 'action' ? '所属页面' : '所属类目'}
              allowClear={node.nodeType !== 'action'}
              disabled={protectedEntry}
              options={parents.map((parent) => ({
                label: `${parent.name} / ${parent.nameEn}`,
                value: parent.code,
              }))}
              placeholder={group || page ? '顶层（可选类目）' : '请选择页面'}
            />
          </Form.Item>
        )}
        {page && (
          <Form.Item
            name="visible"
            label="菜单可见性"
            valuePropName="checked"
            extra="仅控制导航入口；隐藏不等于禁止访问。"
          >
            <Checkbox aria-label="在左侧菜单显示" disabled={protectedEntry}>
              在左侧菜单显示
            </Checkbox>
          </Form.Item>
        )}
        <Form.Item
          name="enabled"
          label="启用状态"
          valuePropName="checked"
          extra={
            group
              ? '停用后隐藏类目；子权限仍按自身状态鉴权。'
              : '停用后该权限不生效，已有授权也不可使用。'
          }
        >
          <Switch aria-label="启用资源" disabled={protectedEntry} />
        </Form.Item>
        {!group && (
          <Form.Item
            className="permission-resource-full"
            name="publicAllowed"
            valuePropName="checked"
            extra="允许后仍需在角色管理的公共权限中显式授权。"
          >
            <Checkbox disabled={protectedEntry}>允许设为公共权限</Checkbox>
          </Form.Item>
        )}
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      <div className="permission-resource-footer">
        <Button disabled={pending} onClick={onCancel}>
          {creating ? '取消新增' : '重置修改'}
        </Button>
        <Button type="primary" loading={pending} htmlType="submit">
          保存配置
        </Button>
      </div>
    </Form>
  );
}
