import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, Spin, Typography } from 'antd';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { useState, type PropsWithChildren } from 'react';
import { ApiError } from '../../../shared/api/httpClient';
import {
  getCurrentUser,
  currentUserKey,
  login,
  logout,
  sendLoginCode,
} from '../api/authApi';
import { AuthContext } from '../authContext';
import { LoginBackground } from './LoginBackground';

export function AuthGate({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const userQuery = useQuery({ queryKey: currentUserKey, queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: true });
  const user = userQuery.error instanceof ApiError && userQuery.error.status === 401 ? undefined : userQuery.data;
  const [submitting, setSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');

  if (userQuery.isPending) return <div className="auth-loading"><Spin /></div>;

  if (!user) {
    const submit = async (values: { phone: string; code?: string }) => {
      setError('');
      setSubmitting(true);
      try {
        if (!codeSent) {
          await sendLoginCode(values.phone);
          setCodeSent(true);
        } else {
          await login(values.phone, values.code ?? '');
          await queryClient.cancelQueries();
          queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth'
            || (query.queryKey[1] !== 'current-user' && query.queryKey[1] !== 'login-background') });
          await queryClient.fetchQuery({ queryKey: currentUserKey, queryFn: getCurrentUser, staleTime: 0 });
        }
      } catch (reason) {
        setError(reason instanceof ApiError ? reason.message : '操作失败，请稍后重试');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <main className="auth-page">
        <LoginBackground />
        <div className="auth-overlay" />
        <div className="auth-layout">
          <section className="auth-intro" aria-label="构想台">
            <div className="auth-brand"><span><Sparkles size={22} /></span>构想台</div>
            <p>正在登录至</p>
            <h1>需求工作台</h1>
          </section>
          <section className="auth-panel">
          <div className="auth-heading">
            <span className="auth-heading-icon"><LockKeyhole size={22} /></span>
            <Typography.Title level={2}>登录构想台</Typography.Title>
            <Typography.Paragraph>使用手机号验证码登录</Typography.Paragraph>
          </div>
          <Form layout="vertical" onFinish={submit} initialValues={{ phone: '13800000000' }}>
            <Form.Item label="手机号" name="phone" rules={[{ required: true }, { pattern: /^1\d{10}$/, message: '请输入有效的手机号' }]}>
              <Input size="large" disabled={codeSent} placeholder="请输入手机号" />
            </Form.Item>
            {codeSent && <Form.Item label="验证码" name="code" rules={[{ required: true, message: '请输入验证码' }]} extra="开发环境验证码：123456">
              <Input size="large" inputMode="numeric" maxLength={6} placeholder="请输入 6 位验证码" />
            </Form.Item>}
            {error && <div className="auth-error">{error}</div>}
            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              {codeSent ? '登录' : '获取验证码'}
            </Button>
          </Form>
          </section>
        </div>
      </main>
    );
  }

  const handleLogout = async () => {
    await logout();
    await queryClient.cancelQueries();
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth'
      || (query.queryKey[1] !== 'current-user' && query.queryKey[1] !== 'login-background') });
    queryClient.setQueryData(currentUserKey, null);
    setCodeSent(false);
  };

  return <AuthContext.Provider value={{ user, logout: handleLogout }}>{children}</AuthContext.Provider>;
}
