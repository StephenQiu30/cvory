# Obsidian 使用说明

`docs` 是纯文档目录，也是 Obsidian vault。原始需求、设计、PRD、Plan、模板和附件在这里维护，通过 Git 协作。入口为 [文档导航](00-文档导航.md)，管理机制见 [设计 01](design/01-文档管理与Obsidian设计.md)。阅读和维护不需要安装 Node、生成文件或启动服务。

## 打开与阅读

在 Obsidian 选择“打开文件夹作为仓库”，选择本仓库的 `docs`。核心搜索、反向链接、关系图谱、提纲、模板和 Workspaces 已配置，没有社区插件。日常从文档导航沿 design → prd → plan 阅读。原始需求位于 `requirement`，模板位于 `templates`，附件位于 `assets`。

内部链接使用相对 Markdown。自动链接更新已关闭。重命名现行文档时，同步导航和引用。原始需求进入本库后保持原文，不随重命名改写。

个人布局、图谱设置、书签和回收站不提交 Git。可在 Workspaces 保存“需求评审”“架构设计”等布局。

## 根规范与工程说明

[PROJECT](../PROJECT.md)、[AGENTS](../AGENTS.md)、[BACKLOG](../BACKLOG.md)、[HANDOVER](../HANDOVER.md) 的唯一编辑位置在仓库根目录。[DESIGN](../DESIGN.md)在根目录维护视觉与交互规范；`CONTRIBUTING.md` 尚未建立。各工程 README 留在工程原位置；当前仓库没有工程目录。

文档用仓库相对链接引用根规范，不在 vault 复制正文。Obsidian 导航以 vault 为范围，vault 外的文件在代码编辑器或仓库页面阅读。仓库入口见 [README](../README.md)。

## 维护与检查

新增设计在 [设计导航](design/00-设计导航.md) 登记。技术合同写在 design，人读范围与验收写在对应 [PRD](prd/00-PRD导航.md)，实施步骤写在其子 [Plan](plan/00-Plan导航.md)。任务顺序与状态只维护在根 [BACKLOG](../BACKLOG.md)。

修改后核对编号、相对链接、锚点、路径大小写和事实一致性。原始需求入库后不自动格式化或重写正文。Obsidian 配置检查与客户端布局、图谱验证分别报告。
