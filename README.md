# 自由人联合体前端 · 0.0.2 内部测试版

当前以成员、分享、分类、权限和开放平台为核心；需求构想/拆解/发布/承接/验收已下线，不在工程整改中恢复。

## 开发入口

- [前端架构](docs/前端架构.md)
- [编码规范（权威入口）](docs/编码规范.md)
- [接口与状态](docs/接口与状态管理规范.md)
- [样式与组件](docs/样式与组件规范.md)
- [测试规范](docs/测试规范.md)
- [文档版本索引](docs/文档索引.md)

Node/npm沿用项目环境，依赖以package-lock.json固定；npm ci后npm run dev。完整验证npm run check与npm run format:check。当前API/CORS/七牛域名配置沿用原值；本次不新增匿名公开页或完整E2E。

后端为同机demand-workbench-backend项目，当前同为release-0.0.2。既有审查报告及本次整改记录位于docs/reviews，保留历史证据，不视为每次发布验收。
