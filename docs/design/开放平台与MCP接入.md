# 开放平台与 MCP 接入

实现日期：2026-11-06。

入口：系统配置 → API 密钥与 MCP（独立页 `/system/api-keys`）。个人设置入口为系统配置 → 个人设置（`/system/settings`），旧 `/settings` 自动跳转。支持创建名称、权限范围和有效期，完整密钥仅展示一次，列表仅含脱敏元数据，支持撤销与Codex连接说明。

前端模块为src/features/open-platform，使用TanStack Query管理密钥列表和撤销；创建结果不进入Query或mutation缓存，仅在弹窗局部状态短暂保留。关闭即清除明文，不写localStorage/sessionStorage。服务端权限交集决定可执行操作，前端显隐不是安全边界。

后端模块：openplatform负责凭据持久化及生命周期，mcp负责无状态Streamable HTTP协议和分享工具适配。详情、部署和协议约束见后端docs/open-platform.md与docs/api.md。

首版支持普通文本创建/查询/更新私密分享；不包含公开申请、图片上传、删除、OAuth授权、调用计费或平台限流。密钥只访问MCP，不授予网页会话或账号管理权限。

## 验证记录

- 新增前端4项测试通过；类型检查、Lint、生产构建通过。
- 前端全量104项：103项通过，RoleEditor.test.tsx的展开/收起测试在5秒超时；未修改该模块，不将全量检查描述为通过。
- 后端全量177项：无失败，1项可选测试跳过。最后新增权限收回、非法范围和20把密钥上限场景后，开放平台4项MySQL集成测试再次通过。
- 独立MySQL 8.4容器验证全部Flyway迁移；浏览器使用真实后端18089、前端15189，桌面1440×1000和手机390×844。
- 完整路径通过：页面创建密钥→关闭弹窗移除明文→刷新列表→MCP初始化并保存→分享页刷新回显→页面撤销→MCP返回401；无页面运行错误，手机无整页横向溢出，表格可局部横向滚动。
- Browser插件不可用，使用Playwright；截图保存在/tmp/demand-openplatform-desktop.png和/tmp/demand-openplatform-mobile.png。临时环境与测试数据均在独立容器，验证后删除，不写入用户现有数据库。
- 未执行公网部署、反向代理或真实Codex客户端连接；验证由真实HTTP MCP调用完成。正式使用需重启后端应用新迁移，并按配置指向可达的后端域名。
