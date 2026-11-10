import {
  Alert,
  App,
  Button,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Image,
  Spin,
  Switch,
  Table,
  Tabs,
} from 'antd';
import { useAccountPlatform } from '../hooks/useAccountPlatform';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eligibilityKey, getPublisherEligibility } from '../../auth';
import { kindNames, roleNames, timeText } from '../accountPresentation';
import { publisherBadges, publisherBadgePreviews } from '../publisherBadges';
import type { LevelRule } from '../api/accountApi';
import { contractorBadges, contractorBadgePreviews } from '../contractorBadges';

const badgeSets = { publisher: publisherBadges, contractor: contractorBadges };
const badgePreviewSets = { publisher: publisherBadgePreviews, contractor: contractorBadgePreviews };

export default function AccountCenter() {
  const { modal } = App.useApp();
  const [badgePreview, setBadgePreview] = useState<{
    open: boolean;
    index: number;
    kind: keyof typeof badgeSets;
  }>({ open: false, index: 0, kind: 'publisher' });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [allHistory, setAllHistory] = useState(false);
  const eligibility = useQuery({ queryKey: eligibilityKey, queryFn: getPublisherEligibility });
  const { overview, rules, activate, taskModule } = useAccountPlatform();
  if (overview.isPending)
    return (
      <section className="settings-section">
        <Spin />
      </section>
    );
  if (overview.isError)
    return (
      <section className="settings-section">
        <Alert
          type="error"
          title={overview.error.message}
          action={<Button onClick={() => void overview.refetch()}>重试</Button>}
        />
      </section>
    );
  const account = overview.data;
  const badgeLevels = Object.keys(badgeSets[badgePreview.kind]);
  const badgeImages = badgeLevels.flatMap((level) => {
    const src = badgePreviewSets[badgePreview.kind][level];
    const name =
      rules.data?.find((rule) => rule.kind === badgePreview.kind && rule.levelCode === level)
        ?.levelName || '';
    return src ? [{ src, alt: `${level} ${name}徽章` }] : [];
  });
  return (
    <>
      <section className="settings-section">
        <Collapse
          ghost
          className="settings-identity-collapse"
          styles={{ header: { padding: 0 }, body: { padding: '16px 0 0' } }}
          items={[
            {
              key: 'identity',
              label: <h2>我的身份</h2>,
              children: (
                <>
                  <div className="settings-section-heading settings-identity-intro">
                    <p className="settings-subtitle">
                      管理角色：
                      {account.roleNames?.length
                        ? account.roleNames.join('、')
                        : account.roleName || roleNames[account.role] || '自定义角色'}
                      。业务成长与信用分别记录。
                    </p>
                    <Button type="link" onClick={() => setRulesOpen(true)}>
                      查看身份规则
                    </Button>
                  </div>
                  {eligibility.isError ? (
                    <Alert
                      type="error"
                      title={eligibility.error.message}
                      action={<Button onClick={() => void eligibility.refetch()}>重试</Button>}
                    />
                  ) : (
                    eligibility.data && (
                      <Alert
                        type={eligibility.data.canPublish ? 'success' : 'info'}
                        title={`发布资格：${eligibility.data.message}`}
                        showIcon
                      />
                    )
                  )}
                  {account.identities.map((identity) => (
                    <div className="account-identity" key={identity.kind}>
                      <div className="account-identity-heading">
                        <h3>
                          {kindNames[identity.kind]} · {identity.levelCode} {identity.levelName}
                        </h3>
                        {identity.kind === 'contractor' && (
                          <div className="account-module-control">
                            <span>任务模块</span>
                            <Switch
                              aria-label="任务模块"
                              checked={identity.taskModuleEnabled}
                              checkedChildren="开启"
                              unCheckedChildren="关闭"
                              loading={taskModule.isPending}
                              disabled={!identity.taskModuleEnabled && identity.status !== 'active'}
                              onChange={(enabled) => {
                                if (enabled) taskModule.mutate(true);
                                else
                                  modal.confirm({
                                    title: '关闭任务模块？',
                                    okText: '关闭',
                                    cancelText: '取消',
                                    onOk: () => taskModule.mutateAsync(false),
                                  });
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <Descriptions
                        column={{ xs: 1, sm: 3 }}
                        items={[
                          {
                            key: 'status',
                            label: '身份状态',
                            children: identity.status === 'active' ? '正常' : '受限',
                          },
                          { key: 'growth', label: '成长值', children: identity.growthPoints },
                          {
                            key: 'credit',
                            label: '信用变化',
                            children: identity.creditRecorded ? identity.creditScore : '暂无记录',
                          },
                        ]}
                      />
                    </div>
                  ))}
                  {!account.identities.some((identity) => identity.kind === 'contractor') && (
                    <Button onClick={() => activate.mutate()} loading={activate.isPending}>
                      开放任务模块
                    </Button>
                  )}
                  {taskModule.isError && (
                    <Alert type="error" title={taskModule.error.message} showIcon />
                  )}
                  {activate.isError && (
                    <Alert type="error" title={activate.error.message} showIcon />
                  )}
                  <Drawer
                    title="身份与等级规则"
                    open={rulesOpen}
                    onClose={() => setRulesOpen(false)}
                    size="min(640px, 100vw)"
                  >
                    {rules.isError ? (
                      <Alert type="error" title={rules.error.message} />
                    ) : (
                      <Tabs
                        items={(['publisher', 'contractor'] as const).map((kind) => ({
                          key: kind,
                          label: kindNames[kind],
                          children: (
                            <Table
                              loading={rules.isPending}
                              dataSource={rules.data?.filter((rule) => rule.kind === kind)}
                              rowKey="levelCode"
                              size="small"
                              pagination={false}
                              columns={[
                                {
                                  title: '徽章',
                                  width: 72,
                                  align: 'center' as const,
                                  render: (_: unknown, rule: LevelRule) =>
                                    badgeSets[kind][rule.levelCode] ? (
                                      <Button
                                        type="text"
                                        className="publisher-badge-button"
                                        aria-label={`放大查看${rule.levelCode}徽章`}
                                        title="点击放大查看"
                                        onClick={() =>
                                          setBadgePreview({
                                            open: true,
                                            index: Object.keys(badgeSets[kind]).indexOf(
                                              rule.levelCode,
                                            ),
                                            kind,
                                          })
                                        }
                                      >
                                        <img
                                          className="publisher-rule-badge"
                                          src={badgeSets[kind][rule.levelCode]}
                                          alt={`${rule.levelCode} ${rule.levelName}徽章`}
                                          width={48}
                                          height={48}
                                        />
                                      </Button>
                                    ) : null,
                                },
                                {
                                  title: '等级',
                                  dataIndex: 'levelCode',
                                  width: 56,
                                  align: 'center' as const,
                                },
                                { title: '名称', dataIndex: 'levelName', width: '32%' },
                                {
                                  title: '成长门槛',
                                  render: (_: unknown, rule: LevelRule) => (
                                    <span
                                      className={
                                        rule.sortOrder > 1 && !rule.enabled
                                          ? 'rule-threshold-unset'
                                          : undefined
                                      }
                                    >
                                      {rule.sortOrder <= 1
                                        ? rule.sortOrder === 0
                                          ? '未开通正式资格'
                                          : '开通起始等级'
                                        : rule.enabled
                                          ? rule.minPoints
                                          : '未配置'}
                                    </span>
                                  ),
                                },
                              ]}
                            />
                          ),
                        }))}
                      />
                    )}
                    <Image.PreviewGroup
                      items={badgeImages}
                      preview={{
                        open: badgePreview.open,
                        current: badgePreview.index,
                        alt: badgeImages[badgePreview.index]?.alt,
                        onOpenChange: (open) =>
                          setBadgePreview((previous) => ({ ...previous, open })),
                        onChange: (index) =>
                          setBadgePreview((previous) => ({ ...previous, index })),
                      }}
                    />
                  </Drawer>
                  <h3>成长与信用记录</h3>
                  {account.history.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成长或信用变化" />
                  ) : (
                    <Table
                      rowKey="eventNo"
                      size="small"
                      dataSource={allHistory ? account.history : account.history.slice(0, 3)}
                      pagination={allHistory ? { pageSize: 10 } : false}
                      scroll={{ x: 520 }}
                      columns={[
                        { title: '时间', dataIndex: 'createdAt', render: timeText },
                        {
                          title: '身份',
                          dataIndex: 'kind',
                          render: (kind: keyof typeof kindNames) => kindNames[kind],
                        },
                        {
                          title: '变化',
                          render: (_, item) =>
                            `${item.metric === 'growth' ? '成长' : '信用'} ${item.delta > 0 ? '+' : ''}${item.delta}`,
                        },
                        { title: '原因', dataIndex: 'reason' },
                      ]}
                    />
                  )}
                  {account.history.length > 3 && (
                    <Button type="link" onClick={() => setAllHistory(!allHistory)}>
                      {allHistory ? '收起记录' : '查看全部成长与信用记录'}
                    </Button>
                  )}
                </>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
