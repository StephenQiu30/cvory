# 项目接手文档

任务调度只在 [BACKLOG](BACKLOG.md)。

## 工作台 shadcn 信息展示

视觉规则见 [DESIGN](DESIGN.md)。顶栏和工作台标签页原先自行绘制的黑色选中下划线已移除，改用 NavigationMenu 与 Tabs 的柔和填充选中态，蓝色只点缀选中文字。键盘焦点轮廓继续保留。

[Figma 桌面稿](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=7-2880)、[手机稿](https://www.figma.com/design/sLNuFRPH0Zg6gF8YfNNCsR?node-id=7-3644)及相关状态稿先于页面同步，保留可编辑图层。数量使用 Badge；工作区、模板、Markdown 和导入入口使用 Card 的标题、说明、内容与操作组合；空状态使用 Empty，加载使用 Skeleton，必要的内容分隔使用低对比 Separator。模板封面悬停和键盘预览采用中性表面；空白简历封面显示“待填写”，并适配深色主题。

业务范围仍为简历管理、模板、Markdown、导入和公开展示。模板创建保留空白正文，示例只用于预览；导入仍限 CVory v1 JSON／Markdown，校对后另存。分享进入公开管理，公开内容仍为固定快照。

### 验证与运行边界

- 前端类型检查、`pnpm lint`、`pnpm build` 通过；lint 保留 `postcss.config.mjs` 的既有匿名默认导出警告。Docker 前端生产构建通过。
- 独立临时 SQLite、模拟邮件与 example.com 合成账户下，完整 Playwright 套件 16 项通过。新增选中态无下划线、标签页方向键切换的回归断言，覆盖桌面与手机；原有模板空白创建、改名、副本独立、删除取消、Markdown 校对、文件合同、账户流程、公开快照和编辑保存用例通过。
- 桌面、手机、浅色及深色展示已检查，手机没有页面横向溢出。本地 1234 前端已同步；没有修改真实账户、简历或公开数据，也没有数据库迁移或初始化。后端代码未改，后端单测未重跑。
- 交付分支为 `main`，提交和推送结果以 Git 记录为准。仓库未配置远端 CI；公网部署、完整跨浏览器与无障碍验收仍待完成。

工程规则见 [PROJECT](PROJECT.md)，业务合同见 [产品设计 02](docs/design/02-CV制作管理与展示设计.md)。
