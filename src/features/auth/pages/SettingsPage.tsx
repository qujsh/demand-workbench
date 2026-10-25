import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Button, Descriptions, Form, Input, message } from 'antd';
import { Link } from 'react-router-dom';
import { useAuth } from '../authContext';
import { currentUserKey, saveProfile } from '../api/authApi';
import './settings.css';
import AccountSecurity from '../components/AccountSecurity';
import { AccountCenter } from '../../account';

const statusNames: Record<string, string> = {
  active: '正常', restricted: '受限', suspended: '暂停', banned: '禁用', closing: '注销中', closed: '已注销',
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [feedback, contextHolder] = message.useMessage();
  const save = useMutation({
    mutationFn: saveProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserKey, updated);
      void feedback.success('个人资料已保存');
    },
  });
  return <main className="settings-page">
    {contextHolder}
    <header className="topbar"><Link to="/requirements">需求管理</Link><span>/</span><strong>个人设置</strong></header>
    <div className="settings-content">
      <h1>个人设置</h1>
      <p className="settings-subtitle">管理你的个人资料和登录账号</p>
      <section className="settings-summary">
        <Avatar size={56}>{user.nickname.slice(0, 1).toUpperCase()}</Avatar>
        <div><h2>{user.nickname}</h2><p>{user.userNo} · {user.publisherLevelName || '未开通发布人身份'}</p></div>
      </section>
      <section className="settings-section">
        <h2>个人资料</h2>
        <Form layout="vertical" initialValues={{ nickname: user.nickname }} onFinish={(values: { nickname: string }) => save.mutate(values.nickname.trim())}>
          <Form.Item name="nickname" label="昵称" rules={[{ required: true, whitespace: true, message: '请输入昵称' }, { max: 64, message: '昵称不能超过64个字符' }]}>
            <Input maxLength={64} showCount placeholder="请输入昵称" />
          </Form.Item>
          {save.isError && <Alert type="error" title={save.error.message} showIcon />}
          <Button type="primary" htmlType="submit" loading={save.isPending}>保存资料</Button>
        </Form>
      </section>
      <section className="settings-section">
        <h2>账号信息</h2>
        <Descriptions column={1} colon={false} items={[
          { key: 'number', label: '账号编号', children: user.userNo },
          { key: 'phone', label: '绑定手机号', children: user.phone ? user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '未绑定' },
          { key: 'status', label: '账号状态', children: statusNames[user.status] || '未知状态' },
          { key: 'level', label: '发布人等级', children: user.publisherLevel ? `${user.publisherLevel} · ${user.publisherLevelName || user.publisherLevel}` : '未开通' },
        ]} />
        <Button onClick={() => void logout().catch(() => feedback.error('退出失败，请稍后重试'))}>退出登录</Button>
      </section>
      <AccountSecurity />
      <AccountCenter />
    </div>
  </main>;
}
