import { Alert, Button, Drawer, Form, Input, InputNumber, Space, Switch, TreeSelect } from 'antd';
import type { PermissionInput, PermissionNode } from '../api/permissionApi';

type ModuleOption = { value: string; title: string; children: ModuleOption[] };
type Props = {
  node: PermissionNode | null; nodeType: PermissionNode['nodeType']; parentCode: string | null;
  catalog: PermissionNode[]; pending: boolean; error?: string;
  onSave: (input: PermissionInput) => Promise<void>; onCancel: () => void;
};
export function PermissionNodeEditor({ node, nodeType, parentCode, catalog, pending, error, onSave, onCancel }: Props) {
  const [form] = Form.useForm<PermissionInput>();
  const isModule = nodeType === 'module';
  const excluded = new Set(node ? [node.code] : []);
  for (let i = 0; i < catalog.length; i++) for (const item of catalog) if (item.parentCode && excluded.has(item.parentCode)) excluded.add(item.code);
  const options = (parent: string | null): ModuleOption[] => catalog.filter((item) => item.nodeType === 'module' && item.parentCode === parent && !excluded.has(item.code)).map((item) => ({ value: item.code, title: `${item.name} / ${item.nameEn}`, children: options(item.code) }));
  return <Drawer title={`${node ? '编辑' : '新增'}${isModule ? '模块' : '权限'}`} open size="min(680px, 100vw)" onClose={() => { if (!pending) onCancel(); }} footer={<Space><Button disabled={pending} onClick={onCancel}>取消</Button><Button type="primary" loading={pending} onClick={() => form.submit()}>保存定义</Button></Space>}>
    <Form form={form} layout="vertical" initialValues={node ?? { code: '', parentCode, nodeType, name: '', nameEn: '', description: '', descriptionEn: '', sortOrder: 0, enabled: true, publicAllowed: false, version: 0 }} onFinish={(values) => { void onSave({ ...values, publicAllowed: !isModule && !!values.publicAllowed, code: node?.code ?? values.code, nodeType, parentCode: values.parentCode || null, version: node?.version ?? 0 }).catch(() => undefined); }}>
      <Alert type="info" showIcon title={node?.builtIn ? '内置节点可编辑中英文文案与排序；编码、层级和授权属性受保护。' : '编码创建后固定。权限定义保存后可供角色分配，业务控制需接入对应编码。'} />
      <Form.Item name="code" label="英文编码" rules={[{ required: true, message: '请输入英文编码' }, { pattern: /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/, message: '使用小写英文、数字及点、下划线或连字符' }]} extra="例如 assignments、assignments.read；编码不是英文名称。"><Input aria-label="英文编码" disabled={!!node} maxLength={64} /></Form.Item>
      <Form.Item name="parentCode" label="上级模块" rules={[{ required: !isModule, message: '请选择所属模块' }]}><TreeSelect aria-label="上级模块" treeData={options(null)} treeDefaultExpandAll allowClear={isModule} placeholder={isModule ? '不选则为根模块' : '请选择所属模块'} disabled={node?.builtIn} /></Form.Item>
      <div className="permission-editor-grid">
        <Form.Item name="name" label="中文名称" rules={[{ required: true, whitespace: true, message: '请输入中文名称' }]}><Input aria-label="中文名称" maxLength={80} /></Form.Item>
        <Form.Item name="nameEn" label="英文名称" rules={[{ required: true, whitespace: true, message: '请输入英文名称' }]}><Input aria-label="英文名称" maxLength={120} /></Form.Item>
        <Form.Item name="description" label="中文说明"><Input.TextArea aria-label="中文说明" rows={3} maxLength={300} /></Form.Item>
        <Form.Item name="descriptionEn" label="英文说明"><Input.TextArea aria-label="英文说明" rows={3} maxLength={600} /></Form.Item>
        <Form.Item name="sortOrder" label="排序" rules={[{ required: true, message: '请输入排序值' }]}><InputNumber aria-label="排序" min={0} max={99999} precision={0} /></Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch aria-label="启用权限节点" disabled={node?.builtIn} /></Form.Item>
      </div>
      {!isModule && <Form.Item name="publicAllowed" label="允许配置为公共权限" valuePropName="checked" extra="允许后仍需在公共权限中显式勾选；不会自动授予所有账号。"><Switch aria-label="允许配置为公共权限" disabled={node?.builtIn} /></Form.Item>}
      {error && <Alert type="error" showIcon title={error} />}
    </Form>
  </Drawer>;
}
