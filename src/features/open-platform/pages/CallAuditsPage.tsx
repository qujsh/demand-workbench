import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, DatePicker, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { memberNumber } from '../../../shared/identity/memberPresentation';
import { usePermissions } from '../../account/hooks/usePermissions';
import { listCallAudits, type CallAudit, type CallAuditFilters } from '../api/callAuditApi';
import './apiKeysPage.css';
const outcomes = { running: '执行中', success: '成功', error: '失败' };
const tools = {
  create_share: '创建分享',
  search_shares: '搜索分享',
  get_share: '读取分享',
  update_share: '更新分享',
};
export default function CallAuditsPage() {
  const access = usePermissions();
  const [filters, setFilters] = useState<CallAuditFilters>({
    scope: 'self',
    page: 1,
    pageSize: 20,
  });
  const canAll = access.can('call-audits.read-all');
  const effective = {
    ...filters,
    scope: canAll ? filters.scope : ('self' as const),
    userNo: canAll && filters.scope === 'all' ? filters.userNo : undefined,
  };
  const query = useQuery({
    queryKey: ['open-platform', 'call-audits', effective],
    queryFn: ({ signal }) => listCallAudits(effective, signal),
    enabled: access.can('call-audits.view'),
  });
  const change = (value: Partial<CallAuditFilters>) =>
    setFilters((previous) => ({ ...previous, ...value, page: 1 }));
  return (
    <main className="api-keys-page">
      <header className="topbar">
        <span>系统配置</span>
        <span>/</span>
        <strong>调用审计</strong>
      </header>
      <div className="api-keys-content call-audits-content">
        <h2>调用审计</h2>
        <p>
          查看 MCP
          调用与密钥诊断的执行结果。记录请求编号、工具、耗时和错误码，不保存密钥、分享正文或完整参数。管理后台的操作记录请在「操作审计」查看。
        </p>
        {!access.isPending && !access.can('call-audits.view') ? (
          <Alert type="warning" title="没有查看调用审计的权限" />
        ) : (
          <>
            <Space wrap className="call-audit-filters">
              {canAll && (
                <Select
                  aria-label="查看范围"
                  value={effective.scope}
                  onChange={(scope) => change({ scope, userNo: undefined })}
                  options={[
                    { value: 'self', label: '我的调用' },
                    { value: 'all', label: '全部账号' },
                  ]}
                />
              )}
              {canAll && effective.scope === 'all' && (
                <Input.Search
                  aria-label="成员编号"
                  placeholder="成员编号"
                  allowClear
                  onSearch={(userNo) => change({ userNo: userNo || undefined })}
                />
              )}
              <Input.Search
                aria-label="密钥编号"
                placeholder="密钥编号 KEY-…"
                allowClear
                onSearch={(keyNo) => change({ keyNo: keyNo || undefined })}
              />
              <Select
                aria-label="调用工具"
                placeholder="全部工具"
                allowClear
                value={filters.tool}
                onChange={(tool) => change({ tool })}
                style={{ minWidth: 130 }}
                options={Object.entries(tools).map(([value, label]) => ({ value, label }))}
              />
              <Select
                aria-label="调用结果"
                placeholder="全部结果"
                allowClear
                value={filters.outcome}
                onChange={(outcome) => change({ outcome })}
                style={{ minWidth: 120 }}
                options={Object.entries(outcomes).map(([value, label]) => ({ value, label }))}
              />
              <DatePicker.RangePicker
                showTime
                onChange={(range) =>
                  change({ from: range?.[0]?.toISOString(), to: range?.[1]?.toISOString() })
                }
              />
              <Button
                onClick={() => void query.refetch()}
                loading={query.isFetching}
                disabled={!access.can('call-audits.view')}
              >
                刷新
              </Button>
            </Space>
            {query.isError && (
              <Alert
                type="error"
                showIcon
                title={query.error.message}
                action={<Button onClick={() => void query.refetch()}>重试</Button>}
              />
            )}
            <p>
              符合筛选：{query.data?.total ?? 0} 次 · 成功 {query.data?.successCount ?? 0} 次 · 失败{' '}
              {query.data?.errorCount ?? 0} 次
            </p>
            <Table<CallAudit>
              rowKey="requestNo"
              size="small"
              loading={query.isFetching || access.isPending}
              dataSource={query.data?.records ?? []}
              scroll={{ x: 1100 }}
              locale={{ emptyText: '暂无调用记录' }}
              pagination={{
                current: filters.page,
                pageSize: filters.pageSize,
                total: query.data?.total ?? 0,
                showSizeChanger: false,
                onChange: (page) => setFilters((previous) => ({ ...previous, page })),
              }}
              columns={[
                {
                  title: '时间',
                  dataIndex: 'createdAt',
                  render: (value) => new Date(value).toLocaleString('zh-CN'),
                  width: 175,
                },
                ...(effective.scope === 'all'
                  ? [
                      {
                        title: '调用账号',
                        key: 'actor',
                        render: (_: unknown, row: CallAudit) => (
                          <>
                            {row.nickname ?? '已删除账号'}
                            <div>{row.userNo ? memberNumber({ userNo: row.userNo }) : '—'}</div>
                          </>
                        ),
                      },
                    ]
                  : []),
                {
                  title: '密钥',
                  key: 'key',
                  render: (_, row) => (
                    <>
                      {row.keyName}
                      <div>
                        <Typography.Text copyable={{ text: row.keyNo }} type="secondary">
                          {row.keyNo}
                        </Typography.Text>
                      </div>
                    </>
                  ),
                },
                {
                  title: '方法 / 工具',
                  key: 'tool',
                  render: (_, row) => (
                    <>
                      {row.tool ? (tools[row.tool as keyof typeof tools] ?? row.tool) : row.method}
                      <div>{row.tool && row.method}</div>
                    </>
                  ),
                },
                {
                  title: '结果',
                  key: 'result',
                  render: (_, row) => (
                    <>
                      <Tag
                        color={
                          row.outcome === 'success'
                            ? 'green'
                            : row.outcome === 'error'
                              ? 'red'
                              : 'blue'
                        }
                      >
                        {outcomes[row.outcome]}
                      </Tag>
                      <div>{row.errorCode}</div>
                    </>
                  ),
                },
                {
                  title: '耗时',
                  dataIndex: 'durationMs',
                  render: (value, row) => (row.outcome === 'running' ? '—' : `${value} ms`),
                },
                {
                  title: '请求 / 资源编号',
                  key: 'request',
                  render: (_, row) => (
                    <>
                      <Typography.Text copyable={{ text: row.requestNo }}>
                        {row.requestNo}
                      </Typography.Text>
                      <div>{row.resourceNo}</div>
                    </>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>
    </main>
  );
}
