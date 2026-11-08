import { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Tooltip,
} from 'antd';
import { McpConnectionGuide } from './McpConnectionGuide';
import { useApiKeys } from '../hooks/useApiKeys';
import type { ApiKey, CreateKey } from '../api/apiKeyApi';
import './apiKeys.css';

const scopeNames = {
  'shares:read': '读取分享',
  'shares:create': '创建分享',
  'shares:update': '更新分享',
};
const status = (key: ApiKey) =>
  key.revokedAt
    ? '已撤销'
    : key.expiresAt && Date.parse(key.expiresAt) <= Date.now()
      ? '已过期'
      : '有效';
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN') : '尚未使用';

export function ApiKeySettings({ permissions }: { permissions?: string[] }) {
  const { query, remove, createKey, refresh } = useApiKeys();
  const [deleteNo, setDeleteNo] = useState<string | null>(null);
  const deleteTarget = query.data?.find((key) => key.keyNo === deleteNo);
  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.keyNo);
      setDeleteNo(null);
    } catch {
      // 删除失败时保留弹窗，展示 mutation 返回的错误。
    }
  }
  const [detailNo, setDetailNo] = useState<string | null>(null);
  const detail = query.data?.find((key) => key.keyNo === detailNo);
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<CreateKey>();
  const close = () => {
    if (creating) return;
    setOpen(false);
    setSecret(null);
    setError(null);
    form.resetFields();
  };
  async function submit(values: CreateKey) {
    setCreating(true);
    setError(null);
    try {
      const created = await createKey(values);
      setSecret(created.secret);
      void refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建失败，请重试');
    } finally {
      setCreating(false);
    }
  }
  return (
    <section className="settings-section api-key-settings">
      <div className="api-key-heading">
        <h2>API 密钥与 MCP</h2>
      </div>
      <div className="api-key-intro">
        <p>
          列表展示你的 API
          密钥。完整密钥仅在创建时显示，请妥善保存，不要分享给他人或暴露在浏览器等客户端代码中。
        </p>
        <p>密钥权限与账号当前权限共同决定可用能力。单个账号最多可拥有 20 把有效密钥。</p>
      </div>
      <div className="api-key-toolbar">
        {(permissions === undefined || permissions.includes('call-audits.view')) && (
          <Button href="/system/call-audits">查看调用记录</Button>
        )}
        <Button
          type="primary"
          disabled={permissions !== undefined && !permissions.includes('shares.use')}
          onClick={() => setOpen(true)}
        >
          创建 API 密钥
        </Button>
      </div>
      {query.isError && (
        <Alert
          type="error"
          showIcon
          title={query.error.message}
          action={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      )}
      <Table<ApiKey>
        className="api-key-table"
        rowKey="keyNo"
        size="small"
        loading={query.isPending}
        dataSource={query.data ?? []}
        pagination={{ pageSize: 5, hideOnSinglePage: true }}
        scroll={{ x: 960 }}
        locale={{ emptyText: '还没有 API 密钥' }}
        columns={[
          {
            title: '名称',
            key: 'name',
            width: 180,
            render: (_, key) => (
              <div className="api-key-row-name">
                <span title={key.name}>{key.name}</span>
                {status(key) !== '有效' && <Tag>{status(key)}</Tag>}
              </div>
            ),
          },
          {
            title: '密钥编号',
            key: 'tracking',
            width: 220,
            render: (_, key) => (
              <Typography.Text
                className="api-key-tracking"
                copyable={{ text: key.keyNo }}
                title={key.keyNo}
              >
                {key.keyNo.slice(0, 12)}…{key.keyNo.slice(-10)}
              </Typography.Text>
            ),
          },
          {
            title: '密钥（脱敏）',
            key: 'key',
            width: 230,
            render: (_, key) => <span className="api-key-prefix">{key.prefix}••••••••</span>,
          },
          {
            title: '创建日期',
            key: 'created',
            width: 120,
            render: (_, key) => new Date(key.createdAt).toLocaleDateString('sv-SE'),
          },
          {
            title: '最近使用日期',
            key: 'used',
            width: 130,
            render: (_, key) =>
              key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString('sv-SE') : '尚未使用',
          },
          {
            title: '',
            key: 'action',
            width: 100,
            render: (_, key) => (
              <Space size={4}>
                <Tooltip title="查看详情">
                  <Button
                    type="text"
                    aria-label="详情"
                    icon={<FileText size={16} />}
                    onClick={() => setDetailNo(key.keyNo)}
                  />
                </Tooltip>
                <Button
                  danger
                  type="text"
                  title="删除密钥"
                  aria-label="删除"
                  icon={<Trash2 size={16} />}
                  onClick={() => {
                    remove.reset();
                    setDeleteNo(key.keyNo);
                  }}
                />
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title="删除 API 密钥"
        open={!!deleteTarget}
        centered
        width={420}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={remove.isPending}
        closable={!remove.isPending}
        cancelButtonProps={{ disabled: remove.isPending }}
        mask={{ closable: false }}
        onCancel={() => {
          if (!remove.isPending) setDeleteNo(null);
        }}
        onOk={() => void confirmDelete()}
      >
        <div className="api-key-delete-copy">
          <p>确定删除密钥「{deleteTarget?.name}」吗？</p>
          <p>删除后，使用此密钥的客户端将无法继续访问。</p>
          <p className="api-key-delete-note">历史调用记录将保留。</p>
        </div>
        {remove.isError && <Alert type="error" showIcon title={remove.error.message} />}
      </Modal>
      <Modal
        title="API 密钥详情"
        open={!!detail}
        onCancel={() => setDetailNo(null)}
        footer={<Button onClick={() => setDetailNo(null)}>关闭</Button>}
        width={560}
      >
        {detail && (
          <Descriptions
            column={1}
            bordered
            size="small"
            className="api-key-details"
            items={[
              { key: 'name', label: '名称', children: detail.name },
              {
                key: 'no',
                label: '密钥编号',
                children: <Typography.Text copyable>{detail.keyNo}</Typography.Text>,
              },
              { key: 'prefix', label: '密钥（脱敏）', children: `${detail.prefix}…` },
              {
                key: 'scope',
                label: '权限范围',
                children: (
                  <Space wrap size={4}>
                    {detail.scopes.map((scope) => (
                      <Tag key={scope}>{scopeNames[scope]}</Tag>
                    ))}
                  </Space>
                ),
              },
              { key: 'status', label: '状态', children: status(detail) },
              {
                key: 'expiry',
                label: '有效期',
                children: detail.expiresAt ? date(detail.expiresAt) : '永久有效',
              },
              { key: 'created', label: '创建时间', children: date(detail.createdAt) },
              { key: 'last', label: '最近使用', children: date(detail.lastUsedAt) },
              ...(detail.revokedAt
                ? [{ key: 'revoked', label: '撤销时间', children: date(detail.revokedAt) }]
                : []),
            ]}
          />
        )}
        <p className="api-key-detail-note">完整密钥仅在创建时展示，无法从详情中恢复。</p>
      </Modal>
      <McpConnectionGuide />
      <Modal
        title={secret ? '保存你的 API 密钥' : '创建 API 密钥'}
        open={open}
        onCancel={close}
        closable={!creating}
        mask={{ closable: false }}
        footer={
          secret ? (
            <Button type="primary" onClick={close}>
              我已保存，关闭
            </Button>
          ) : null
        }
        destroyOnHidden
      >
        {secret ? (
          <>
            <Alert
              type="warning"
              showIcon
              title="完整密钥只展示这一次"
              description="关闭后无法再次查看。请保存在密码管理器或本机安全存储，不要发送给他人。"
            />
            <Typography.Paragraph className="api-key-secret" copyable={{ text: secret }}>
              {secret}
            </Typography.Paragraph>
          </>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => void submit(values)}
            initialValues={{ scopes: ['shares:read'], validDays: 90 }}
          >
            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, whitespace: true, message: '请输入用途名称' }, { max: 64 }]}
            >
              <Input maxLength={64} placeholder="例如：我的 Codex" />
            </Form.Item>
            <Form.Item
              name="scopes"
              label="权限范围"
              rules={[{ required: true, type: 'array', min: 1, message: '至少选择一项权限' }]}
            >
              <Checkbox.Group
                options={Object.entries(scopeNames).map(([value, label]) => ({
                  value,
                  label,
                  disabled:
                    permissions !== undefined &&
                    (value === 'shares:create'
                      ? !permissions.includes('shares.create')
                      : value === 'shares:update'
                        ? !permissions.includes('shares.edit')
                        : false),
                }))}
              />
            </Form.Item>
            <Form.Item name="validDays" label="有效期">
              <Select
                options={[7, 30, 90, 180, 365, 0].map((value) => ({
                  value,
                  label: value === 0 ? '永久有效' : `${value} 天`,
                }))}
              />
            </Form.Item>
            {error && <Alert type="error" showIcon title={error} />}
            <Button type="primary" htmlType="submit" loading={creating}>
              创建密钥
            </Button>
          </Form>
        )}
      </Modal>
    </section>
  );
}
