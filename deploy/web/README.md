# 前端部署到七牛云

本项目是 React + Vite 静态前端。只上传生产构建产物，不上传源码、node_modules、环境文件或密钥。手动工作流名称为 **Deploy frontend to Qiniu**，不会因 push 自动发布，也不修改后端或 ECS。

## 一次性准备

1. 创建专用**公开空间** `freeligo-web`，不要复用业务图片空间或私有空间。
2. 绑定自定义域名（例如 `https://www.example.com`），配置 DNS、HTTPS 证书。国内 CDN 使用已备案域名。新空间的七牛测试域名存在强制下载/静态页面限制，本脚本不支持使用测试域名作为正式站点入口。
3. 开启默认首页，访问 `/` 和 `/index.html` 都应直接返回 `200` 和 `text/html`，不能强制下载或跳转到其他地址。
4. 当前前端保留 Browser 路由。必须在实际使用的七牛托管/CDN方案中配置**页面路径内部回退到根 index.html，响应 200，并保留地址栏原路径**。至少 `/shares`、`/system/settings`、登录和其他前端路由刷新都应正常。仅配置默认首页不够，普通返回 404 的自定义错误页也不算完成。`/releases/*` 下真实文件必须按原路径访问，缺失 JS/CSS 应返回 404，不能返回 HTML。如果所用产品不支持这种回退，先调整托管方案或另行将前端切换为 Hash 路由，不要仅设置确认变量绕过此要求。
5. CDN 和浏览器缓存规则：`/`、`/index.html` 和所有页面路由不缓存/每次重新验证；`/releases/*` 下的版本资源可长期缓存。规则优先级应让版本目录命中长期缓存、其余路径不缓存。不要单独把 `/index.html` 设为不缓存，却让 `/shares` 缓存旧入口。
6. 准备公网 HTTPS API，例如 `https://api.example.com`。当前 ECS 只开放 SSH 测试入口，公网 HTTPS 需另行配置。后端 CORS 必须明确允许前端来源并允许凭证；当前项目使用 Cookie + SameSite=Lax，建议前后端使用同一主域名下的 HTTPS 子域名。正确处理反向代理 HTTPS 信息和 Cookie Secure，图片下载也改为 HTTPS。这些基础设施和认证调整不由此工作流自动完成。
7. 为 CI 准备专用七牛凭据，限制到前端空间的上传、读取对象状态及所需 CDN 刷新权限。密钥仅保存为 GitHub Secrets，不放入前端 `VITE_` 环境变量或仓库文件。

官方参考：[静态页面](https://developer.qiniu.com/kodo/8604/a-static-page-management)、[域名访问策略](https://developer.qiniu.com/kodo/13421/safety-visit)、[Python SDK 上传和 CDN 刷新](https://developer.qiniu.com/kodo/sdk/python)。SDK 与其依赖版本固定在 requirements.txt；上传和管理请求使用 HTTPS。

## GitHub 配置清单

前端仓库 Settings → Secrets and variables → Actions。

**Repository secrets：**

| 名称               | 内容                     |
| ------------------ | ------------------------ |
| `QINIU_ACCESS_KEY` | 前端发布使用的 AccessKey |
| `QINIU_SECRET_KEY` | 对应 SecretKey           |

**Repository variables（Variables 标签页）：**

| 名称                       | 示例/要求                                                     |
| -------------------------- | ------------------------------------------------------------- |
| `QINIU_WEB_BUCKET`         | `freeligo-web`，独立公开空间                                  |
| `QINIU_WEB_ORIGIN`         | `https://www.example.com`，不含路径、参数或末尾文件名         |
| `VITE_API_BASE_URL`        | `https://api.example.com`，不附加 `/api`，不能是 localhost/IP |
| `VITE_MCP_PUBLIC_URL`      | 可留空，或 `https://api.example.com/mcp`                      |
| `QINIU_SPA_FALLBACK_READY` | 完成路由回退与缓存设置后填 `true`                             |

前端域名和 API 地址会进入公开构建产物，这是预期行为。不得将服务商、数据库、SSH 或其他秘密配置放入 `VITE_` 变量。空间地域由七牛 SDK 根据空间查询，不沿用后端图片空间的上传地域。

## 正常发布

合入 **main** 后：Actions → **Deploy frontend to Qiniu** → Run workflow → 选 main，`restore_sha` 留空。其他分支会跳过整个部署 job。

流程：检查配置 → 发布脚本测试 → npm ci → 类型检查/ESLint/Vitest → 使用生产配置构建 → 上传版本资源 → 检查公网文件内容 → 更新根入口 → 刷新 CDN → 验证根入口和页面路径 → Actions Summary。

质量检查覆盖 `npm run check` 的四项；工作流把子命令展开，以便只构建一次并传入 `--base=/releases/<完整SHA>/`。测试固定 `--maxWorkers=1`，避免组件测试争用资源，不跳过测试、不放宽超时。依赖来自 package-lock.json，不升级前端包。七牛凭据仅注入上传步骤，不注入 npm 安装、测试或构建步骤。

空间中会形成：

```text
index.html                         # 当前入口，最后更新
releases/<完整SHA>/index.html      # 保留版本的入口
releases/<完整SHA>/assets/...      # 此版本专用资源
releases/<另一个SHA>/...
```

不会删除旧版本。同一 SHA 的已有对象若内容相同则复用；内容不同则拒绝覆盖。更改生产 API 等构建配置后，需要新提交再发布。同一提交重复构建若产物不确定，同样会被拒绝覆盖，以保护历史版本。

## 如何查看成功、失败与恢复

运行页 Summary 的「前端发布」展示目标 SHA、阶段、发布/恢复模式和入口可能变化的提示。

- 测试或构建失败：未执行上传。
- 资源上传或公开访问失败：未切换根入口，当前入口保留；可能留下部分新版本文件。
- 根入口上传超时、CDN 刷新或后续检查失败：**入口可能已变更**，运行标红；请查看网站，不自动宣称旧版本正常，也不自动回滚。
- 成功：版本入口和 HTML 直接依赖资源内容一致，根入口、`/index.html`、`/shares`、`/system/settings` 均返回本次入口。刷新 API 仅表示请求已受理；脚本随后最多约 3 分钟轮询公网入口，仍不能证明全球所有 CDN 节点已同步。
- 强制终止/取消可能导致来不及写入最终报告，需人工确认站点状态。Summary 失败不能直接解释为停站。

恢复历史版本：重新运行同一工作流，在 `restore_sha` 填**曾成功发布的完整 40 位 SHA**。恢复时不重新构建，不覆盖版本资源；从保留目录读取原入口，验证资源可访问后重新更新根 index.html、刷新和检查。输入值不是分支名或短 SHA。恢复所用的 API 地址仍是历史构建里的地址，不会用当前变量重写历史 JS。

若只是上次未完全上传的目录，或历史文件被清理，恢复会在切换前失败。请长期保留当前版和已确认可用的回退版。清理是独立的人工维护动作，不由发布脚本自动执行。

## 本地验证（不写入七牛）

```bash
python3 -m unittest discover -s deploy/web/tests -v
npm run check
```

生产域名、Cookie/CORS、真实登录、图片直传和移动端业务联调需等配置完成后验收。发布脚本成功只证明静态文件及路由访问通过，不表示这些业务已经验证。
