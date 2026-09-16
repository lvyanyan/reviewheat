# HANDOFF — 下个会话从这里开始

> 每次会话结束时更新本文件：状态快照 + 下一步 backlog + 环境启动清单。
> 最后更新：2026-09-16（会话 8：v0.4.0 --llm + --tests 完成，36 测试全绿，feat/llm-0.4 分支）。
>
> **仓库已达到"可发布"状态**：v0.3.1 + 真数据 demo GIF + 50 PR 评测背书 +
> 三篇发布文案（docs/RELEASE.md）。剩下的是发布日本人的操作。

## 状态快照

- 版本：**v0.3.1**（package.json 与 src/cli.ts VERSION 已同步，有测试锁定）
- **分支策略（2026-09-16 起）**：main 冻结在 v0.3.1 = 发布候选；v0.4 开发在
  `feat/llm-0.4` 分支（已推远端），照常小步提交+推送备份，做完测试全绿再
  merge 回 main。发布窗口期的 hotfix 打在 main 上。
- **本机 OCR 已配置可用**：`ocr config set` 已写入 dashscope + qwen3.6-flash +
  api_key（key 存在 OCR 自身配置文件）。重跑：`cd <repo> && ocr review --format json --output E:/tmp/ocr.json`
- README 首屏 demo GIF 已就位：docs/img/demo.gif（素材：vite#23446 真实 PR）
- ffmpeg 已装（~/bin，npmmirror 镜像二进制）；发布素材管线可复用
- README 首屏 demo GIF 已就位：docs/img/demo.gif（素材：vite#23446 真实 PR）
- 远端：`https://github.com/lvyanyan/reviewheat`（**私有**，公开动作留给发布日）
- 本地：`E:\reviewheat`，main 分支
- 可用功能：worktree / --last / --ref 分析、终端摘要、单文件 HTML 热力图、
  --fail-on 门禁、**--ocr（读文件/stdin）与 --with-ocr（真单命令，自动跑 OCR）**；
  --pr / --llm 为诚实占位（提示版本号 + exit 2）
- 评测台：`npx tsx scripts/bench.mjs [每仓库PR数]`（需隧道）；单 PR 探针
  `scripts/probe.mjs <owner/repo> <pr号>`；首轮结果见 docs/BENCH.md
  （30 PR：误报 0、27/30 压缩比 ≤30%）
- GitHub Actions：**已激活**（`.github/workflows/ci.yml`，Node 20/22/24 矩阵，
  首跑 success @ 4e8368e）。token 已含 `repo, workflow` scope。

## 环境启动清单（新会话必读）

1. 本机不能直连 github.com。先起隧道（后台）：
   `ssh -D 1080 -N -o BatchMode=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes hk`
   验证：`curl -s --socks5-hostname 127.0.0.1:1080 https://api.github.com/zen`
2. git 推送模板（token 不落 shell 历史/日志）：
   ```bash
   cd /e/reviewheat
   B64=$(printf 'lvyanyan:%s' "$(cat /e/oss-contrib/.token)" | base64 -w0)
   git -c http.https://github.com/.extraheader="AUTHORIZATION: basic $B64" push
   ```
   （git 已全局配置 http.https://github.com/.proxy = socks5h://127.0.0.1:1080）
3. token 速查：`.token`（classic，repo 权限，万能款）；`.token-own`
   （fine-grained，仅授权 9 个老仓库，对本仓库无写权限）。续期流程见
   `E:\oss-contrib\使用说明.md` 第二节。
4. ~~待办钩子：token 补 `workflow` scope 后补推 CI~~ ✅ 2026-09-16 完成，
   CI 首跑全绿（4e8368e）。
5. 常用命令：`npm test`（18 用例）/ `npm run build` / `npx tsx src/cli.ts --no-open`。

## 下一步 backlog（按序）

1. **发布日**：按 docs/RELEASE.md 清单执行——转公开 → Show HN → Reddit
   r/opensource → V2EX，北京时间周二至四 20:00-22:00。发帖人：用户本人。
2. **发布后 48h**：守评论（RELEASE.md 有应答模板）、issue 快速响应、
   有 bug 当天发版。
3. **v0.4 `--llm`**：OpenAI 兼容 API（env: REVIEWHEAT_LLM_API_KEY/BASE_URL/
   MODEL；支持 Ollama；永不提供 --api-key CLI 参数）。
4. **AI-heavy 仓库专项评测**（发布后迭代）：找 agent 高产出的仓库样本。
5. v0.5+：GitHub Action、--pr、独立二进制。

## 会话维护规则（三条硬性要求，用户指定）

1. 开发过程记录归档：每次会话在 `docs/DEVLOG.md` 追加条目（做了什么/决策/坑）。
2. 测试留档：跑完测试把结果写入 `docs/TESTING.md` 运行记录表。
3. 产品文档同步：功能/权重/契约/路线图变化必须同步 `docs/PRODUCT.md`。

## 仓库结构调整（2026-09-16 发布日）

仓库已转公开。内部文档（本目录：DEVLOG/TESTING/HANDOFF/RELEASE/PRODUCT-zh/
BENCH-zh/AGENTS-full）**不再入库**（docs-internal/ 已 gitignore），只在本地
维护——三条归档纪律不变，但对象是本地目录。公开版 docs/ 只留英文
BENCH.md、PRODUCT.md 和素材。git 历史已压成单条 "initial public release"
（旧中文文档与发布剧本从历史中一并清除）。下次会话注意：更新归档时改
docs-internal/ 下的文件，别在 docs/ 里新建中文文档。

## 发布日状态（2026-09-16 20:30）

- 仓库已转公开 + 历史清洗完成（单条 v0.3.1 公开提交，英文公开文档）
- 掘金：文章已提交，审核中（链接 juejin.cn/spost/7685966242269184038，过审后可公开访问）
- HelloGitHub：已提交收录申请，等审核
- HN：新号被限 Show HN → dang 邮件已起草（dang-email.txt），收件人改为
  hn@ycombinator.com（dang@ 已退信不存在）、称呼改 "Hi HN moderators"，
  待用户重发；或养号 1-2 周后自行发
- Reddit：u/zuoqing 被 r/opensource 年龄门槛 + 站级过滤器双重拦截，进入
  养号期（1-2 周内零自荐帖），HN/Reddit 发布顺延为"下一个大事件"
- 48h 内：守掘金/HelloGitHub/仓库的 issue 与评论；有 bug 报告转 feat/llm-0.4

## 发布日执行记录（2026-09-16 晚，全部完成 ✅）

| 时间 | 事件 |
|---|---|
| 19:2x | 仓库转公开；描述 + 8 个 topics 设置；密钥扫描干净 |
| 19:4x | 发现中文内部文档公开暴露 → 移入 docs-internal/（不入库）+ 英文公开文档重写 + git 历史压成单条 v0.3.1 公开提交（a89df85）强推，RELEASE/HANDOFF 从历史中清除 |
| 20:00 | Show HN 被新号限制（HN 官方临时政策）→ 启动 dang 邮件路线 |
| 20:05 | Reddit r/opensource 被 1 年年龄门槛删帖 |
| 20:1x | Reddit r/SideProject 被站级过滤器删 → Reddit 进入养号期（1-2 周零自荐） |
| 20:1x | 掘金文章提交，审核中；HelloGitHub 收录申请提交 ✓ |
| 20:10 | dang@ycombinator.com 退信（地址不存在）→ 改 hn@ycombinator.com |
| 20:3x | **HN 邮件已重发至 hn@ycombinator.com（"Hi HN moderators"），等待回信 ✅** |

## 下个会话入口

1. 检查三渠道反馈：掘金评论（过审后链接 juejin.cn/spost/7685966242269184038）、
   HelloGitHub 收录结果、GitHub issue/PR——用户会贴过来，帮起草回复；
2. dang 回信后：对接措辞、按版主指示执行 Show HN；
3. v0.4 `--llm` 开发在 feat/llm-0.4 分支继续（设计已定：REVIEWHEAT_LLM_API_KEY/
   BASE_URL/MODEL env 三件套，支持 Ollama，只分类低置信 hunk，无 --api-key 参数）；
4. AI-heavy 仓库专项评测（docs/BENCH.md 遗留项）择机补跑。

## 会话 8 追加（2026-09-16 晚）

v0.4.0 在 feat/llm-0.4 完成（未合并 main——发布窗口期 main 保持 v0.3.1）。
配置本机 LLM：export REVIEWHEAT_LLM_API_KEY=<百炼 key> REVIEWHEAT_LLM_BASE_URL=
https://dashscope.aliyuncs.com/compatible-mode/v1 REVIEWHEAT_LLM_MODEL=qwen3.6-flash
