import { Alert, Button, Space, Typography, message } from 'antd';
import { buildApiUrl } from '../../../shared/api/httpClient';
import { resolveMcpEndpoint } from '../endpoint';

const repository = 'https://github.com/qujsh/demand-workbench-skills';
const installCommand =
  'npx skills add qujsh/demand-workbench-skills --skill demand-workbench-archive -a codex -g';

export function ArchiveSkillGuide() {
  const [messageApi, context] = message.useMessage();
  const endpoint = resolveMcpEndpoint(
    import.meta.env.VITE_MCP_PUBLIC_URL || buildApiUrl('/mcp'),
    import.meta.env.PROD,
  );
  const prompt = `请从 ${repository} 安装 demand-workbench-archive Skill，按其中 setup.md 配置归档，MCP 地址使用 ${endpoint.url ?? ''}。密钥由我在本机终端隐藏输入，不放进聊天。我授权在各项目默认保存每轮问题、完整最终回复和明确图片，请保留现有全局指令并添加归档规则，已有地址配置变更前先向我说明。`;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      void messageApi.success('已复制');
    } catch {
      void messageApi.error('复制失败，请手动复制');
    }
  }
  return (
    <section className="api-key-guide" aria-label="Codex 问答归档 Skill">
      {context}
      <div className="mcp-section-heading">
        <h3>把 Codex 问答和配图保存到构想台</h3>
        <p>安装归档 Skill，使用自己的密钥，将问答保存为私密笔记。</p>
      </div>
      <Space wrap>
        <Button type="primary" onClick={() => void copy(installCommand)}>
          复制安装命令
        </Button>
        <Button href={`${repository}/releases/latest/download/demand-workbench-archive.zip`}>
          下载 Skill
        </Button>
        <Button href={repository} target="_blank" rel="noopener noreferrer">
          查看仓库
        </Button>
      </Space>
      <ol className="mcp-steps">
        <li>
          <h4>安装 Skill</h4>
          <p>在终端执行安装命令；也可下载 ZIP，解压到 ~/.codex/skills/。选择一种安装方式即可。</p>
          <div className="mcp-code">
            <pre>{installCommand}</pre>
          </div>
          <p className="mcp-caption">支持 macOS、Python 3.9+；命令安装另需 Node.js 22.20+。</p>
        </li>
        <li>
          <h4>配置本人密钥</h4>
          <p>
            在上方创建密钥，勾选创建笔记和上传图片权限。重新打开 Codex，让它按 Skill
            引导配置，在本机终端隐藏输入密钥。
          </p>
          {endpoint.error ? (
            <Alert type="error" showIcon title={endpoint.error} />
          ) : (
            <div className="mcp-endpoint">
              <span>当前环境 MCP</span>
              <Typography.Text copyable>{endpoint.url}</Typography.Text>
            </div>
          )}
        </li>
        <li>
          <h4>选择保存方式</h4>
          <p>偶尔保存：对 Codex 说「使用 $demand-workbench-archive 保存本轮问答及附件」。</p>
          <p>每轮默认保存：复制以下配置指令发给 Codex，授权后添加全局归档规则，新开聊天生效。</p>
          <Button disabled={!endpoint.url} onClick={() => void copy(prompt)}>
            复制默认归档配置指令
          </Button>
        </li>
      </ol>
      <p className="mcp-content-note">
        安装本身不会开启对话上传。服务不可用时跳过，不补传旧内容；可随时对 Codex
        说「暂停构想台归档」。Skill 自带 MCP 客户端，下方手动 MCP 配置可按需使用。
      </p>
    </section>
  );
}
