import { Alert, Button, Descriptions, Empty, Spin, Table, Tabs } from 'antd';
import { useAccountPlatform } from '../hooks/useAccountPlatform';
import AdminPanel from './AdminPanel';
import CollaborationPanel from './CollaborationPanel';
import { kindNames, roleNames, timeText } from '../accountPresentation';

export default function AccountCenter() {
  const { overview, rules, activate } = useAccountPlatform();
  if (overview.isPending) return <section className="settings-section"><Spin /></section>;
  if (overview.isError) return <section className="settings-section"><Alert type="error" title={overview.error.message} action={<Button onClick={() => void overview.refetch()}>重试</Button>} /></section>;
  const account = overview.data;
  return <>
    <section className="settings-section">
      <h2>业务身份与成长</h2>
      <p className="settings-subtitle">平台角色：{roleNames[account.role] || account.role}。业务成长与信用分别记录。</p>
      {account.identities.map((identity) => <div className="account-identity" key={identity.kind}>
        <h3>{kindNames[identity.kind]} · {identity.levelCode} {identity.levelName}</h3>
        <Descriptions column={{ xs: 1, sm: 3 }} items={[
          { key: 'status', label: '身份状态', children: identity.status === 'active' ? '正常' : '受限' },
          { key: 'growth', label: '成长值', children: identity.growthPoints },
          { key: 'credit', label: '信用变化', children: identity.creditRecorded ? identity.creditScore : '暂无记录' },
        ]} />
      </div>)}
      {!account.identities.some((identity) => identity.kind === 'contractor') && <>
        <p className="settings-subtitle">开通承接人后从 J1「公士」开始，发布人身份不受影响。</p>
        <Button onClick={() => activate.mutate()} loading={activate.isPending}>开通承接人身份</Button>
      </>}
      {activate.isError && <Alert type="error" title={activate.error.message} showIcon />}
    </section>
    <section className="settings-section">
      <h2>等级说明</h2>
      {rules.isError ? <Alert type="error" title={rules.error.message} /> : <Tabs items={(['publisher', 'contractor'] as const).map((kind) => ({ key: kind, label: kindNames[kind], children: <Table loading={rules.isPending} dataSource={rules.data?.filter((rule) => rule.kind === kind)} rowKey="levelCode" size="small" pagination={{ pageSize: 8, hideOnSinglePage: true }} columns={[
        { title: '等级', dataIndex: 'levelCode', width: 80 }, { title: '名称', dataIndex: 'levelName' },
        { title: '成长门槛', render: (_, rule) => rule.sortOrder <= 1 ? (rule.sortOrder === 0 ? '未开通正式资格' : '开通起始等级') : rule.enabled ? rule.minPoints : '未配置' },
      ]} /> }))} />}
    </section>
    <section className="settings-section">
      <h2>成长与信用记录</h2>
      {account.history.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成长或信用变化" /> : <Table rowKey="eventNo" size="small" dataSource={account.history} pagination={{ pageSize: 5 }} scroll={{ x: 520 }} columns={[
        { title: '时间', dataIndex: 'createdAt', render: timeText }, { title: '身份', dataIndex: 'kind', render: (kind: keyof typeof kindNames) => kindNames[kind] },
        { title: '变化', render: (_, item) => `${item.metric === 'growth' ? '成长' : '信用'} ${item.delta > 0 ? '+' : ''}${item.delta}` }, { title: '原因', dataIndex: 'reason' },
      ]} />}
    </section>
    <CollaborationPanel />
    {account.permissions.length > 0 && <AdminPanel permissions={account.permissions} rules={rules.data || []} />}
  </>;
}
