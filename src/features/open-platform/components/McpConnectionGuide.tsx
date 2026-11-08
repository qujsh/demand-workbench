import { useState } from 'react';
import { Alert, Button, Input, Space, Typography, message } from 'antd';
import { buildApiUrl } from '../../../shared/api/httpClient';
import { diagnoseApiKey } from '../api/apiKeyApi';
import { resolveMcpEndpoint } from '../endpoint';

export function McpConnectionGuide() {
  const endpoint = resolveMcpEndpoint(
    import.meta.env.VITE_MCP_PUBLIC_URL || buildApiUrl('/mcp'),
    import.meta.env.PROD,
  );
  const [secret, setSecret] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [messageApi, messageContext] = message.useMessage();
  const config = endpoint.url
    ? `[mcp_servers.demand_workbench]\nurl = ${JSON.stringify(endpoint.url)}\nbearer_token_env_var = "DEMAND_WORKBENCH_API_KEY"`
    : '';
  const command = `curl ${"'" + endpoint.url?.replace(/'/g, "'\\''") + "'"} -H "Authorization: Bearer $DEMAND_WORKBENCH_API_KEY" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`;
  async function copy(text: string, name: string) {
    try {
      await navigator.clipboard.writeText(text);
      void messageApi.success({ content: `${name}已复制`, duration: 2, key: 'mcp-copy' });
    } catch {
      void messageApi.error({ content: '复制失败，请手动复制', duration: 3, key: 'mcp-copy' });
    }
  }
  async function diagnose() {
    const value = secret;
    setSecret('');
    setPending(true);
    setResult(null);
    try {
      const data = await diagnoseApiKey(value);
      setResult({
        type: 'success',
        text: `服务端验证通过，工具：${data.tools.join('、') || '无'}。请求编号：${data.requestNo}`,
      });
    } catch (error) {
      setResult({ type: 'error', text: error instanceof Error ? error.message : '验证失败' });
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="api-key-guide" aria-label="连接 MCP 与诊断">
      {messageContext}
      <div className="mcp-section-heading">
        <h3>连接 MCP 与诊断</h3>
        <p>按以下步骤将你的分享连接到 Codex。</p>
      </div>
      {endpoint.error ? (
        <Alert type="error" showIcon title={endpoint.error} />
      ) : (
        <>
          <div className="mcp-endpoint">
            <span>MCP 地址</span>
            <Typography.Text copyable>{endpoint.url}</Typography.Text>
          </div>
          <ol className="mcp-steps">
            <li>
              <h4>创建并保存密钥</h4>
              <p>在上方创建密钥，选择需要的权限，保存仅展示一次的完整密钥。</p>
            </li>
            <li>
              <h4>配置 Codex</h4>
              <p>
                在运行 Codex 的环境中设置 <code>DEMAND_WORKBENCH_API_KEY</code>，然后将以下配置加入{' '}
                <code>config.toml</code>。
              </p>
              <div className="mcp-code">
                <div className="mcp-code-toolbar">
                  <span>config.toml</span>
                  <Button size="small" onClick={() => void copy(config, '配置')}>
                    复制配置
                  </Button>
                </div>
                <pre>{config}</pre>
              </div>
            </li>
            <li>
              <h4>连接并检查工具</h4>
              <p>
                重启 Codex，查看可用工具，再尝试搜索或创建分享。账号权限与密钥范围共同决定可用能力。
              </p>
              <Button onClick={() => void copy(command, '检查命令')}>复制客户端检查命令</Button>
              <p className="mcp-caption">
                如需排查网络，在客户端所在机器执行该命令，使用已设置的密钥环境变量。
              </p>
            </li>
          </ol>
          <p className="mcp-content-note">
            新建内容保持私密；公开或待审核分享的修改仅保存编辑草稿，需在网页确认后发布。密钥仅用于
            MCP，不能登录网页。
          </p>
        </>
      )}
      <div className="mcp-diagnostic">
        <h4>验证本人密钥</h4>
        <p>检查密钥是否有效及服务端可用工具，不会修改分享内容。</p>
        <Space.Compact className="mcp-diagnostic-input">
          <Input.Password
            aria-label="待诊断密钥"
            autoComplete="off"
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value);
              setResult(null);
            }}
            placeholder="粘贴本人密钥，仅用于本次验证"
            disabled={pending}
          />
          <Button loading={pending} disabled={!secret.trim()} onClick={() => void diagnose()}>
            验证密钥
          </Button>
        </Space.Compact>
        <p className="mcp-caption">
          密钥在请求发起后清除。服务端验证通过，不代表客户端到公网地址的网络已连通。
        </p>
        {result && <Alert type={result.type} showIcon title={result.text} />}
      </div>
    </section>
  );
}
