# 项目接手文档

本文件只保留最近一次阶段记录。任务状态见 [BACKLOG](BACKLOG.md)。

## GitHub 公开仓库与 main 首次入库

日期：2026-11-01（Asia/Shanghai）。负责人明确授权创建公开 GitHub 仓库，将项目提交到 main 并推送。

仓库：[StephenQiu30/cvory](https://github.com/StephenQiu30/cvory)，公开，默认分支 main。首次入库提交：`d3e89cf216377d0a907358667bd5eac454afde8b`。该提交已经推送，并通过 git ls-remote 核对远端 main；当前文件与 PROJECT、README、BACKLOG 补充仓库和基线说明，交付提交以 git log 为准。

交付：

- 初始化本地 Git 与 main，配置 origin；首次入库 44 个文件，覆盖需求、根规范、研究证据、模板、通用 Obsidian 配置与 Logo 素材。没有新增应用代码或工程依赖。
- 根目录 .gitignore 排除个人 .obsidian 配置、系统杂项及本地环境/凭据文件；保留 docs 中经过核对的通用 vault 配置。个人配置留在本机，未删除。
- 来源 01～03、05～07 的首次提交基线登记在 [PROJECT](PROJECT.md#35-文档工作区)；6 份原始来源的 SHA-256 与操作前一致，原文、文件名和编号未改。
- 发布内容扫描未发现匹配的密钥、邮箱或手机号；Git 提交作者使用本机已配置身份，未修改 Git 全局身份或配置许可证。
- README、PROJECT 与 BACKLOG 同步仓库地址、main 和 CI 现状；品牌及需求内容不改写。

验证：首次提交前 26 份 Markdown、203 个仓库相对链接、28 个锚点及路径大小写检查通过；JSON 可解析，git diff --cached --check 通过。公开可见性与默认分支由 GitHub API 核对。GitHub Actions 运行列表为空，仓库没有工作流，不记为 CI 通过。元数据提交与最终本地/远端 SHA 一致性由交付时再次核对。

边界：当前是文档与素材基线，没有可运行应用，未进行应用测试、构建或部署。Logo 矢量精修、技术选型及工程实现仍按 [BACKLOG](BACKLOG.md)维护。没有强制推送或历史改写。
