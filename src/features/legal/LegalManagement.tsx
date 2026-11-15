import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { legalApi, type LegalDocument, type LegalKind } from './api/legalApi';
import { LegalPreview } from './LegalPreview';
const FIRST = '9223372036854775807';
/** B端协议管理：上传后先看清理后的实际正文，发布才分配版本；已发布内容只读。 */
export default function LegalManagement() {
  const client = useQueryClient();
  const [messages, context] = message.useMessage();
  const [modal, modalContext] = Modal.useModal();
  const [tab, setTab] = useState('documents');
  const [kind, setKind] = useState<LegalKind>('TERMS');
  const [cursors, setCursors] = useState<string[]>([FIRST]);
  const [auditCursors, setAuditCursors] = useState<string[]>([FIRST]);
  const [userInput, setUserInput] = useState('');
  const [userNo, setUserNo] = useState('');
  const [selected, setSelected] = useState<number>();
  const [mobile, setMobile] = useState(false);
  const [editing, setEditing] = useState<LegalDocument>();
  const list = useQuery({
    queryKey: ['legal', 'documents', kind, cursors.at(-1)],
    queryFn: ({ signal }) => legalApi.list(kind, cursors.at(-1)!, signal),
  });
  const preview = useQuery({
    queryKey: ['legal', 'detail', selected],
    queryFn: ({ signal }) => legalApi.detail(selected!, signal),
    enabled: selected !== undefined,
  });
  const audits = useQuery({
    queryKey: ['legal', 'acceptances', userNo, auditCursors.at(-1)],
    queryFn: ({ signal }) => legalApi.acceptances(userNo, auditCursors.at(-1)!, signal),
    enabled: tab === 'acceptances',
  });
  const save = useMutation({
    mutationFn: (html: string) => legalApi.save(kind, html, editing?.id, editing?.revision),
    onSuccess: async (doc) => {
      setSelected(doc.id);
      setEditing(undefined);
      await client.invalidateQueries({ queryKey: ['legal'] });
      messages.success('草稿已保存，请预览后发布');
    },
    onError: (e) => messages.error(e.message),
  });
  const publish = useMutation({
    mutationFn: (doc: LegalDocument) => legalApi.publish(doc.id, doc.revision),
    onSuccess: async (doc) => {
      await client.invalidateQueries({ queryKey: ['legal'] });
      messages.success(`已发布${doc.kind === 'TERMS' ? '用户协议' : '隐私政策'} V${doc.version}`);
    },
    onError: (e) => messages.error(e.message),
  });
  /** 文件仅作为正文输入；不执行原HTML，预览始终来自服务端清理结果。 */
  async function upload(file: File) {
    if (!/\.html?$/i.test(file.name) || file.size > 1000000) {
      messages.error('请选择1MB以内的UTF-8 HTML文件');
      return false;
    }
    const html = await file.text();
    if (html.includes('\uFFFD')) {
      messages.error('文件编码无法识别，请先转换为UTF-8');
      return false;
    }
    save.mutate(html);
    return false;
  }
  const pager = (
    rows: { id: number }[] | undefined,
    stack: string[],
    setStack: (v: string[]) => void,
  ) => (
    <Space>
      <Button disabled={stack.length === 1} onClick={() => setStack(stack.slice(0, -1))}>
        上一页
      </Button>
      <Button
        disabled={rows?.length !== 50}
        onClick={() => setStack([...stack, String(rows!.at(-1)!.id)])}
      >
        下一页
      </Button>
    </Space>
  );
  const documentColumns = [
    {
      title: '版本',
      key: 'version',
      render: (_: unknown, d: LegalDocument) => (
        <Tag color={d.version ? 'green' : 'orange'}>
          {d.version ? `V${d.version}` : `草稿 #${d.id}`}
        </Tag>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      render: (v: string | null) => v?.replace('T', ' ') || '尚未发布',
    },
    { title: '发布人编号', dataIndex: 'publisherId', render: (v: number | null) => v ?? '—' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, d: LegalDocument) => (
        <Space>
          <Button onClick={() => setSelected(d.id)}>预览{d.version ? '正文' : '并发布'}</Button>
          {d.version === null && (
            <Button disabled={save.isPending} onClick={() => setEditing(d)}>
              替换HTML
            </Button>
          )}
        </Space>
      ),
    },
  ];
  return (
    <main style={{ maxWidth: 1200, margin: 'auto', padding: 24 }}>
      {context}
      {modalContext}
      <Typography.Title level={2}>协议管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        上传完整HTML正文，发布时按协议类型自动递增版本。生效日期和更新说明保留在正文中。
      </Typography.Paragraph>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'documents', label: '协议版本' },
          { key: 'acceptances', label: '用户同意记录' },
        ]}
      />
      {tab === 'documents' ? (
        <Card>
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              aria-label="协议类型"
              value={kind}
              style={{ width: 160 }}
              options={[
                { value: 'TERMS', label: '用户协议' },
                { value: 'PRIVACY', label: '隐私政策' },
              ]}
              onChange={(v) => {
                setKind(v);
                setCursors([FIRST]);
                setEditing(undefined);
              }}
            />
            <Upload
              beforeUpload={upload}
              showUploadList={false}
              accept=".html,.htm"
              disabled={save.isPending}
            >
              <Button type="primary" loading={save.isPending}>
                {editing ? `替换草稿 #${editing.id} HTML` : '上传HTML创建草稿'}
              </Button>
            </Upload>
            {editing && <Button onClick={() => setEditing(undefined)}>取消替换</Button>}
          </Space>
          <Alert
            type="info"
            showIcon
            title="请核对实际展示内容"
            description="仅支持UTF-8 HTML，最大1MB。系统保留标题、段落、列表和表格，移除脚本、样式、图片及嵌入内容。请在预览中核对编号、表格和排版；发布后立即成为当前版本且不可覆盖。"
            style={{ marginBottom: 16 }}
          />
          {list.isError ? (
            <Alert
              type="error"
              title={list.error.message}
              action={<Button onClick={() => list.refetch()}>重试</Button>}
            />
          ) : (
            <Table
              rowKey="id"
              loading={list.isPending}
              dataSource={list.data}
              columns={documentColumns}
              pagination={false}
              scroll={{ x: 600 }}
            />
          )}
          {pager(list.data, cursors, setCursors)}
        </Card>
      ) : (
        <Card>
          <Input.Search
            aria-label="用户编号"
            placeholder="输入完整用户编号查询，留空查询全部"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onSearch={() => {
              setUserNo(userInput.trim());
              setAuditCursors([FIRST]);
            }}
            style={{ maxWidth: 400, marginBottom: 16 }}
          />
          {audits.isError ? (
            <Alert
              type="error"
              title={audits.error.message}
              action={<Button onClick={() => audits.refetch()}>重试</Button>}
            />
          ) : (
            <Table
              rowKey="id"
              loading={audits.isPending}
              dataSource={audits.data}
              pagination={false}
              scroll={{ x: 850 }}
              columns={[
                { title: '用户编号', dataIndex: 'userNo' },
                {
                  title: '用户协议',
                  render: (_, a) => (
                    <Button type="link" onClick={() => setSelected(a.termsId)}>
                      V{a.termsVersion}
                    </Button>
                  ),
                },
                {
                  title: '隐私政策',
                  render: (_, a) => (
                    <Button type="link" onClick={() => setSelected(a.privacyId)}>
                      V{a.privacyVersion}
                    </Button>
                  ),
                },
                {
                  title: '登录方式',
                  dataIndex: 'loginMethod',
                  render: (v) => (v === 'password' ? '密码' : '短信'),
                },
                { title: '同意时间', dataIndex: 'acceptedAt' },
                { title: '登录事件编号', dataIndex: 'eventNo' },
              ]}
            />
          )}
          {pager(audits.data, auditCursors, setAuditCursors)}
        </Card>
      )}
      <Modal
        open={selected !== undefined}
        onCancel={() => setSelected(undefined)}
        width={900}
        title={
          preview.data
            ? `${preview.data.kind === 'TERMS' ? '用户协议' : '隐私政策'} · ${preview.data.version ? `V${preview.data.version}` : '草稿'}`
            : '协议预览'
        }
        footer={
          <Space>
            <Button onClick={() => setMobile(!mobile)}>{mobile ? '桌面预览' : '手机预览'}</Button>
            <Button onClick={() => setSelected(undefined)}>关闭</Button>
            {preview.data?.version === null && (
              <Button
                type="primary"
                loading={publish.isPending}
                onClick={() =>
                  modal.confirm({
                    title: '确认发布此协议？',
                    content: '发布后立即成为当前版本，正文不可覆盖。请确认已完成校对。',
                    onOk: () => publish.mutateAsync(preview.data!),
                  })
                }
              >
                确认发布
              </Button>
            )}
          </Space>
        }
      >
        {preview.isError ? (
          <Alert type="error" title={preview.error.message} />
        ) : preview.data ? (
          <>
            <Typography.Paragraph
              type="secondary"
              style={{ fontSize: 12, overflowWrap: 'anywhere' }}
            >
              正文摘要：{preview.data.contentHash}
            </Typography.Paragraph>
            <LegalPreview html={preview.data.html} mobile={mobile} />
          </>
        ) : (
          <p>正在加载…</p>
        )}
      </Modal>
    </main>
  );
}
