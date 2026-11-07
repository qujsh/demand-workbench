import { Alert, Button, Form, Input, Result, Typography } from 'antd';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { LoginBackground } from '../components/LoginBackground';
import { useAuthActions, type AuthMode, type AuthValues } from '../hooks/useAuthActions';
import { useAuthPanelTransition } from '../hooks/useAuthPanelTransition';

interface AuthPageProps {
  initialPhone?: string;
  onAuthenticated: () => Promise<void>;
  onPasswordSaved: () => Promise<void>;
}
const passwordRule = /^(?=.*[A-Za-z])(?=.*[0-9])[!-~]{8,64}$/;
const phoneRule = /^1\d{10}$/;
const descriptions: Record<AuthMode, string> = {
  password: '使用手机号和密码，进入你的工作空间',
  sms: '验证手机号后登录，未注册的手机号将自动创建账号',
  set: '验证账号手机号，设置登录密码',
  forgot: '验证账号手机号，重置登录密码',
};

export function AuthPage(props: AuthPageProps) {
  const location = useLocation();
  const mode: AuthMode = location.pathname === '/password/set' ? 'set'
    : location.pathname === '/password/forgot' ? 'forgot' : location.pathname === '/login/sms' ? 'sms' : 'password';
  const panelRef = useAuthPanelTransition(mode);
  return <main className="auth-page">
    <LoginBackground /><div className="auth-overlay" />
    <div className="auth-layout">
      <section className="auth-intro" aria-label="构想台">
        <div className="auth-brand"><span><Sparkles size={22} /></span>构想台</div>
        <p>从一个想法，到清晰的下一步</p><h1>让构想逐步成为现实</h1>
      </section>
      <section ref={panelRef} className="auth-panel" aria-label="账号认证">
        <div key={mode} className={`auth-panel-content${mode === 'set' || mode === 'forgot' ? ' auth-panel-content--password' : ''}`}><AuthForm mode={mode} {...props} /></div>
      </section>
    </div>
  </main>;
}

function AuthForm({ mode, initialPhone, onAuthenticated, onPasswordSaved }: AuthPageProps & { mode: AuthMode }) {
  const location = useLocation();
  const state = location.state as { phone?: unknown } | null;
  const phone = typeof state?.phone === 'string' && phoneRule.test(state.phone) ? state.phone : initialPhone;
  const [form] = Form.useForm<AuthValues>();
  const { send, submit, remaining } = useAuthActions(mode, onAuthenticated, onPasswordSaved);
  const passwordPage = mode === 'set' || mode === 'forgot';
  const title = mode === 'set' ? '设置登录密码' : mode === 'forgot' ? '找回密码' : '登录构想台';
  const linkState = () => ({ phone: form.getFieldValue('phone') as string | undefined });
  const requestCode = async () => {
    try { const values = await form.validateFields(['phone']); send.mutate(values.phone); }
    catch { /* 校验信息由表单展示。 */ }
  };
  if (passwordPage && submit.isSuccess) return <div className="auth-success" role="status">
    <Result status="success" title={mode === 'set' ? '登录密码已设置' : '登录密码已重置'}
      subTitle="为保护账号安全，原有登录已失效。请使用新密码重新登录。"
      extra={<Link to="/login" state={linkState()}><Button type="primary" size="large" block>返回密码登录</Button></Link>} />
  </div>;
  return <>
    {passwordPage && <Link className="auth-back" to="/login" state={linkState()}><ArrowLeft size={16} />返回登录</Link>}
    {passwordPage && <div className="auth-heading">
      <Typography.Title level={2}>{title}</Typography.Title>
      <Typography.Paragraph>{descriptions[mode]}</Typography.Paragraph>
    </div>}
    {!passwordPage && <nav className="auth-methods" aria-label="登录方式">
      <Link to="/login" className={mode === 'password' ? 'is-active' : undefined}
        aria-current={mode === 'password' ? 'page' : undefined} state={linkState()}>账号密码登录</Link>
      <Link to="/login/sms" className={mode === 'sms' ? 'is-active' : undefined}
        aria-current={mode === 'sms' ? 'page' : undefined} state={linkState()}>验证码登录</Link>
    </nav>}
    <Form form={form} layout="vertical" initialValues={{ phone }} requiredMark={false}
      onFinish={(values) => submit.mutate(values)} disabled={submit.isPending}>
      <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }, { pattern: phoneRule, message: '请输入有效的11位手机号' }]}>
        <Input size="large" inputMode="tel" autoComplete="username" maxLength={11} placeholder="请输入手机号" />
      </Form.Item>
      {mode !== 'password' && <>
        <Form.Item label="短信验证码" name="code" rules={[{ required: true, message: '请输入短信验证码' }, { pattern: /^[0-9]{6}$/, message: '请输入6位数字验证码' }]}>
          <Input size="large" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="请输入6位验证码"
            suffix={<Button type="link" className="auth-send" onClick={() => void requestCode()}
              loading={send.isPending} disabled={remaining > 0 || submit.isPending}>
              {remaining > 0 ? `${remaining}秒后重发` : send.isSuccess ? '重新获取' : '获取验证码'}
            </Button>} />
        </Form.Item>
        {send.isSuccess && <p className="auth-code-hint" role="status">验证码已发送至 {send.variables?.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')}，5分钟内有效</p>}
        {send.isError && <Alert className="auth-feedback" type="error" showIcon title={send.error.message} />}
      </>}
      {(mode === 'password' || passwordPage) && <Form.Item label={mode === 'set' ? '登录密码' : mode === 'forgot' ? '新密码' : '密码'} name="password"
        tooltip={passwordPage ? '8–64位，需包含字母和数字，可使用英文符号，不含空格或中文' : undefined}
        validateTrigger={passwordPage ? 'onBlur' : 'onChange'}
        style={passwordPage ? { marginBottom: 32 } : undefined}
        rules={[{ required: true, message: '请输入密码' }, ...(passwordPage ? [{ pattern: passwordRule, message: '需8–64位，包含字母和数字，无空格或中文' }] : [])]}>
        <Input.Password size="large" maxLength={64} autoComplete={passwordPage ? 'new-password' : 'current-password'} placeholder={passwordPage ? '8–64位，包含字母和数字' : '请输入登录密码'} />
      </Form.Item>}
      {passwordPage && <Form.Item label={mode === 'set' ? '确认密码' : '确认新密码'} name="confirmPassword" dependencies={['password']} validateTrigger="onBlur"
        rules={[{ required: true, message: mode === 'set' ? '请再次输入登录密码' : '请再次输入新密码' }, ({ getFieldValue }) => ({ validator(_, value: string) {
          return !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致'));
        } })]}>
        <Input.Password size="large" maxLength={64} autoComplete="new-password" placeholder={mode === 'set' ? '请再次输入登录密码' : '请再次输入新密码'} />
      </Form.Item>}
      {!passwordPage && <div className="auth-forgot">
        {mode === 'password' && <Link to="/password/forgot" state={linkState()}>忘记密码？</Link>}
      </div>}
      {submit.isError && <Alert className="auth-feedback" type="error" showIcon title={submit.error.message} />}
      <Button type="primary" htmlType="submit" size="large" block loading={submit.isPending} disabled={send.isPending}>
        {mode === 'set' ? '确认设置密码' : mode === 'forgot' ? '确认重置密码' : '登录'}
      </Button>
    </Form>
    <div className="auth-footer">
      {passwordPage ? <span>{mode === 'set' ? '设置后可使用手机号和密码登录' : '重置后请使用新密码重新登录'}</span>
        : <>还没有设置密码？<Link to="/password/set" state={linkState()}>设置登录密码</Link></>}
    </div>
  </>;
}
