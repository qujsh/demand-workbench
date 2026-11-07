import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { buildApiUrl } from '../../../shared/api/httpClient';
import { useApiKeys } from '../hooks/useApiKeys';
import type { ApiKey, CreateKey } from '../api/apiKeyApi';
import './apiKeys.css';

const scopeNames = { 'shares:read': '读取分享', 'shares:write': '创建和更新分享' };
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN') : '尚未使用';

export function ApiKeySettings() {
  const { query, revoke, createKey, refresh } = useApiKeys();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<CreateKey>();
  const endpoint = buildApiUrl('/mcp');
  const config = `[mcp_servers.demand_workbench]\nurl = "${endpoint}"\nbearer_token_env_var = "DEMAND_WORKBENCH_API_KEY"`;
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
        <Button type="primary" onClick={() => setOpen(true)}>
          创建 API 密钥
        </Button>
      </div>
      <p>使用 API 密钥，让 Codex 等客户端管理你的分享。操作同时受密钥范围与账号当前权限限制。</p>
      {query.isError && (
        <Alert
          type="error"
          showIcon
          title={query.error.message}
          action={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      )}
      {revoke.isError && <Alert type="error" showIcon title={revoke.error.message} />}
      <Table<ApiKey>
        rowKey="keyNo"
        size="small"
        loading={query.isPending}
        dataSource={query.data ?? []}
        pagination={{ pageSize: 5, hideOnSinglePage: true }}
        scroll={{ x: 700 }}
        locale={{ emptyText: '还没有 API 密钥' }}
        columns={[
          {
            title: '名称 / 密钥',
            key: 'name',
            render: (_, key) => (
              <>
                <div>{key.name}</div>
                <Typography.Text type="secondary">{key.prefix}…</Typography.Text>
              </>
            ),
          },
          {
            title: '权限',
            key: 'scopes',
            render: (_, key) => (
              <Space direction="vertical" size={2}>
                {key.scopes.map((scope) => (
                  <span key={scope}>{scopeNames[scope]}</span>
                ))}
              </Space>
            ),
          },
          {
            title: '状态 / 有效期',
            key: 'status',
            render: (_, key) => (
              <>
                <Tag
                  color={
                    key.revokedAt
                      ? 'default'
                      : Date.parse(key.expiresAt) <= Date.now()
                        ? 'orange'
                        : 'green'
                  }
                >
                  {key.revokedAt
                    ? '已撤销'
                    : Date.parse(key.expiresAt) <= Date.now()
                      ? '已过期'
                      : '有效'}
                </Tag>
                <div>{date(key.expiresAt)}</div>
              </>
            ),
          },
          { title: '最近使用', dataIndex: 'lastUsedAt', render: date },
          {
            title: '操作',
            key: 'action',
            render: (_, key) => (
              <Popconfirm
                title="撤销这把密钥？"
                description="使用此密钥的客户端将无法继续访问。"
                onConfirm={() => revoke.mutateAsync(key.keyNo)}
                okText="撤销"
                cancelText="取消"
              >
                <Button
                  danger
                  type="text"
                  disabled={!!key.revokedAt}
                  loading={revoke.isPending && revoke.variables === key.keyNo}
                >
                  撤销
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />
      <details className="api-key-guide">
        <summary>如何连接 Codex</summary>
        <p>
          MCP 地址：<Typography.Text copyable>{endpoint}</Typography.Text>
        </p>
        <p>
          将密钥保存到运行 Codex 的环境变量 DEMAND_WORKBENCH_API_KEY，再添加以下 MCP
          配置。线上访问请使用 HTTPS。
        </p>
        <Typography.Paragraph copyable={{ text: config }}>
          <pre>{config}</pre>
        </Typography.Paragraph>
        <p>
          支持创建、搜索、读取和更新分享。正文按纯文本保存，可包含
          #标签；新建和更新均保持私密。密钥仅用于 MCP，不能登录网页或管理账号。
        </p>
      </details>
      <Modal
        title={secret ? '保存你的 API 密钥' : '创建 API 密钥'}
        open={open}
        onCancel={close}
        closable={!creating}
        maskClosable={false}
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
                options={Object.entries(scopeNames).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            <Form.Item name="validDays" label="有效期">
              <Select
                options={[7, 30, 90, 180, 365].map((value) => ({ value, label: `${value} 天` }))}
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
