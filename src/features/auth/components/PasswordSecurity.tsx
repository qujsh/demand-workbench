import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Spin } from 'antd';
import { Link } from 'react-router-dom';
import { getPasswordStatus, passwordStatusKey } from '../api/authApi';

export function PasswordSecurity() {
  const status = useQuery({ queryKey: passwordStatusKey, queryFn: getPasswordStatus });
  return <section className="settings-section">
    <h2>登录密码</h2>
    {status.isPending ? <Spin /> : status.isError
      ? <Alert type="error" title={status.error.message} action={<Button onClick={() => void status.refetch()}>重试</Button>} />
      : <>
        <p className="settings-subtitle">{status.data.hasPassword ? '已设置登录密码。修改密码需验证绑定手机号，完成后所有设备需重新登录。'
          : '尚未设置密码。设置后即可使用手机号和密码登录，也可以继续使用短信验证码登录。'}</p>
        <Link to={status.data.hasPassword ? '/password/forgot' : '/password/set'}>
          <Button>{status.data.hasPassword ? '重置登录密码' : '设置登录密码'}</Button>
        </Link>
      </>}
  </section>;
}
