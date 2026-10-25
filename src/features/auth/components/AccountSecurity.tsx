import { Alert, Button, Empty, Popconfirm, Spin, Tag } from 'antd';
import { useAccountSecurity } from '../hooks/useAccountSecurity';

const eventNames: Record<string, string> = {
  login: '登录成功', logout: '退出登录', session_revoked: '退出指定设备', other_sessions_revoked: '退出其他设备',
};
const formatTime = (value: string) => value.replace('T', ' ').slice(0, 16);

export default function AccountSecurity() {
  const { eligibility, sessions, events, revoke } = useAccountSecurity();
  return <>
    <section className="settings-section">
      <h2>发布资格</h2>
      {eligibility.isPending ? <Spin /> : eligibility.isError
        ? <Alert type="error" title={eligibility.error.message} action={<Button onClick={() => void eligibility.refetch()}>重试</Button>} />
        : <>
          <p>{eligibility.data.level && `${eligibility.data.level} · `}{eligibility.data.levelName}</p>
          <Alert type={eligibility.data.canPublish ? 'success' : 'info'} title={eligibility.data.message} showIcon />
        </>}
    </section>
    <section className="settings-section">
      <h2>登录设备</h2>
      <p className="settings-subtitle">仅展示有效登录。退出设备后，该设备需要重新登录。</p>
      {sessions.isPending ? <Spin /> : sessions.isError
        ? <Alert type="error" title={sessions.error.message} action={<Button onClick={() => void sessions.refetch()}>重试</Button>} />
        : <>
          {sessions.data.length === 0 && <Empty description="暂无有效会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          <ul className="settings-security-list">
            {sessions.data.map((session) => <li key={session.sessionNo}>
              <div><strong>{session.device}</strong>{session.current && <Tag color="blue">当前设备</Tag>}
                <p>登录于 {formatTime(session.createdAt)} · 有效至 {formatTime(session.expiresAt)}</p></div>
              {!session.current && <Popconfirm title="退出这个设备？" description="该设备的登录将立即失效。" onConfirm={() => revoke.mutateAsync(session.sessionNo)}>
                <Button danger loading={revoke.isPending && revoke.variables === session.sessionNo}>退出设备</Button>
              </Popconfirm>}
            </li>)}
          </ul>
          {sessions.data.some((session) => !session.current) && <Popconfirm title="退出所有其他设备？" onConfirm={() => revoke.mutateAsync(null)}>
            <Button loading={revoke.isPending && revoke.variables === null}>退出其他所有设备</Button>
          </Popconfirm>}
        </>}
      {revoke.isError && <Alert type="error" title={revoke.error.message} showIcon />}
    </section>
    <section className="settings-section">
      <h2>最近安全记录</h2>
      {events.isPending ? <Spin /> : events.isError
        ? <Alert type="error" title={events.error.message} action={<Button onClick={() => void events.refetch()}>重试</Button>} />
        : events.data.length === 0 ? <Empty description="暂无安全记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          : <ul className="settings-security-list">{events.data.map((event) => <li key={event.id}>
            <div><strong>{eventNames[event.event] || '账号安全操作'}</strong><p>{event.device}</p></div>
            <time>{formatTime(event.createdAt)}</time>
          </li>)}</ul>}
    </section>
  </>;
}
