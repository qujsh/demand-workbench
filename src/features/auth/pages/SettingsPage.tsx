import { App, Button, Descriptions, Typography } from 'antd';
import { useAuth } from '../authContext';
import './settings.css';
import AccountSecurity from '../components/AccountSecurity';
import { PasswordSecurity } from '../components/PasswordSecurity';
import ProfileEditor from '../components/ProfileEditor';
import { AccountCenter } from '../../account';
import { memberNumber } from '../../../shared/identity/memberPresentation';

const statusNames: Record<string, string> = {
  active: '正常',
  banned: '禁用',
  closing: '注销中',
  closed: '已注销',
};
export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { message } = App.useApp();
  return (
    <main className="settings-page">
      <header className="topbar">
        <span>系统配置</span>
        <span>/</span>
        <strong>个人设置</strong>
      </header>
      <div className="settings-content">
        <ProfileEditor key={user.userNo} user={user} />
        <section className="settings-section" aria-labelledby="account-info-heading">
          <h2 id="account-info-heading">账号信息</h2>
          <Descriptions
            column={1}
            colon={false}
            items={[
              {
                key: 'number',
                label: '成员编号',
                children: (
                  <Typography.Text copyable={{ tooltips: ['复制成员编号', '已复制'] }}>
                    {memberNumber(user)}
                  </Typography.Text>
                ),
              },
              {
                key: 'phone',
                label: '绑定手机号',
                children: user.phone
                  ? user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
                  : '未绑定',
              },
              {
                key: 'status',
                label: '账号状态',
                children: statusNames[user.status] || '未知状态',
              },
            ]}
          />
        </section>
        <AccountCenter />
        <PasswordSecurity />
        <AccountSecurity />
        <Button onClick={() => void logout().catch(() => message.error('退出失败，请稍后重试'))}>
          退出登录
        </Button>
      </div>
    </main>
  );
}
