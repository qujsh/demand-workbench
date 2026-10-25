# Skill 使用说明

## 当前可用 Skill

- `frontend-app-builder`：页面新建、整体重构、视觉现代化和设计一致性实现。
- `frontend-testing-debugging`：定位浏览器渲染、交互、控制台和响应式问题。
- `playwright`：执行真实浏览器端到端流程、截图和交互验证。
- `verification`：验证前端、后端、数据库之间的完整业务链路。
- `skill-creator`：当本项目规范稳定并需要跨项目复用时，创建独立规范 Skill。

`nextjs` 不适用于当前项目，因为本项目使用 Vite，而不是 Next.js。

## 使用原则

- 项目日常编辑首先遵守根目录 `AGENTS.md` 和 `docs/`。
- 视觉重构使用 `frontend-app-builder`，但小范围样式修复沿用现有设计，不重新生成整体视觉方案。
- 页面问题先使用 `frontend-testing-debugging`，完整核心流程使用 `playwright`。
- 涉及后端接口和 MySQL 的交付，最后使用 `verification` 做全链路检查。
- 当前规范仍会随产品演进，因此先保存为项目级 Markdown；稳定后再用 `skill-creator` 封装为可安装 Skill。
