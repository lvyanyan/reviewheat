# reviewheat 开发日志（DEVLOG）

> 倒序记录。每个会话结束必须追加本会话条目：做了什么、决策及依据、踩了什么坑。
> 配套：docs/HANDOFF.md（下会话入口）、docs/TESTING.md（测试留档）、
> docs/BENCH.md（批量评测记录）。

## 2026-09-16 · 会话 7：真实 OCR 联调 + 50 PR 评测 + 发布文案

### 完成
- **真实 OCR 联调打通**：`npm i -g @alibaba-group/open-code-review`（npmmirror）
  → `ocr config set provider dashscope` + `providers.dashscope.api_key`（key 运行时
  从 ~/.zcode/v2/config.json 读取，不落日志）+ model qwen3.6-flash → 真跑
  GameManager@5453334（3m48s，产出 4 条真实发现）→ reviewheat --ref 同提交
  --ocr 叠加：4/4 钉住、0 丢失。
- 评测扩充到 10 仓库 50 PR（加 pydantic/deno/redis/zod）：中位压缩比 5.4%、
  39/50 ≤30%、误报 0——跨语言稳定，见 docs/BENCH.md。
- docs/RELEASE.md：转公开 runbook + Show HN / Reddit / V2EX 三篇文案 +
  评论区应答模板。

### 关键情报（OCR provider 答复用户）
- OCR 是多 provider：源码 providers.go 内置 20+ 家（anthropic/openai/
  deepseek/moonshot/gemini/minimax/siliconflow/qianfan/spark/hunyuan/ark/
  xai/z_ai/**ollama（本地）**/litellm…），dashscope 只是其中之一；
  **且有专门的 DASHSCOPE_TOKENPLAN_KEY**（QT 套餐钥匙可直接用）。
- dashscope 走 OpenAI 兼容端点 compatible-mode/v1，模型含 qwen3.8-max/
  qwen3.6-flash/deepseek-v4/glm-5.2/kimi-k2.7 等。
- 非交互配置：`ocr config set provider dashscope` +
  `ocr config set providers.dashscope.api_key <key>` + `...model <m>`。

### 踩坑
- node 不认 git-bash 的 /e/ 路径（解析成 C:\e\tmp）——node 侧一律显式盘符，
  这规矩又被自己验证了一遍。
- winget 在本机 shell 从未可用过（PATH 无 WindowsApps；完整路径调用报
  0x80072efd 无法联网）。ffmpeg 最终从 npmmirror 的 ffmpeg-static 二进制
  镜像下载（29MB，秒级），已装入 ~/bin。**国际大文件下载一律走国内镜像。**

## 2026-09-16 · 会话 6：README demo GIF + `--diff-file`

### 完成
- 新增 `--diff-file <f>`（分析任意 unified diff 文件）与 `--repo <label>`
  （显示用标签）——评测、演示、CI 管道三类场景都需要"喂数据"入口。
- 终端输出支持 `FORCE_COLOR=1`（非 TTY 场景保留 ANSI 色）。
- demo 素材管线：`scripts/ansi2html.mjs`（CLI 输出→终端风格 HTML）、
  `scripts/mkgif.mjs`（PNG 帧→GIF，纯 Node：gifenc+pngjs）+ 无头 Chrome 截图。
- `docs/img/demo.gif`（80KB 三帧）：真实素材 = vitejs/vite#23446 diff（评测
  95% 压缩比那个 PR）+ 示例 OCR 叠加（demo/ocr-demo.json，标注为演示用）。
- devDeps 新增 gifenc、pngjs（GIF 拼装，替代不存在的 ffmpeg；DEVLOG 记录理由）。

### 决策与踩坑
- 无头 Chrome 截图替代浏览器自动化：`chrome --headless=new --screenshot`
  对本地 HTML 零依赖、分辨率可控。
- gifenc 在 tsx(ESM) 下具名导入失败（CJS 互操作探测不到），改默认导入解构。
- 验证脚本里 `cmd1 && cmd2 || cmd3` 的 fallback 写法在 cmd2 成功时也会执行
  cmd3——写成 GIF 落错位置，Linux 惯性思维在长命令链里要小心。
- 后台任务的 shell PATH 与前台不一致（winget 在后台任务里 not found），
  依赖系统工具的任务放前台跑。

## 2026-09-16 · 会话 5：`--with-ocr` 真单命令

### 完成
- `--with-ocr`：reviewheat 自行 spawn `ocr review --format json --output <tmp>`，
  跑完自动解析叠加。stderr/stdout 透传（OCR 跑几分钟，进度可见）；与 `--ocr`
  互斥；未装 ocr 时给安装提示。
- `--ocr -` 支持 stdin（`ocr … | reviewheat --ocr -` 管道一行流）。
- `parseOcrJson` 加固：容忍 JSON 前的杂散输出（逐候选位置重试解析）。
- 测试 29 个全绿；假 ocr.cmd shim 端到端验证 spawn→落盘→解析→钉住→渲染全链路。

### 决策记录
- **`--with-ocr` 是显式授权**：替用户跑 OCR 会烧它的 LLM token（分钟级耗时），
  之前因此只做两步流；用户指出管道仍是两条命令后补齐——敲下这个 flag 即同意。
- **Windows spawn `.cmd` 必须 shell:true**（Node 因 CVE-2024-27980 禁止直接
  spawn .cmd/.bat），改为拼完整命令串执行（也消除 DEP0190 警告）。
- OCR 结果走 `--output` 临时文件而非 stdout 捕获——官方 README 明确推荐
  "AI host agents 用文件输出"，stdout 可能混入进度信息。

### 踩坑
- help 文本模板字符串里写了未转义反引号，直接把模板截断（TS1005）。
- 验证用的假 shim 第一版是 node -e 多层引号转义，bash→cmd→node 三层后必然
  翻车；改纯 cmd 的 `> "%5" echo {...}` 一次通过。临时文件/假二进制一律放
  E:\tmp 显式盘符。

## 2026-09-16 · 会话 4：v0.3 `--ocr` 落地

### 完成
- 调研 OCR JSON schema：读 `alibaba/open-code-review` 源码确认
  `jsonOutput.comments[]`（`LlmComment`: path/content/start_line/end_line/
  category/severity），没有盲猜格式。
- 新增 `src/ocr.ts`：宽容解析（信封/裸数组/键名变体都认）+ `applyOcr`
  按行钉到 hunk（新行号区间覆盖判定；不在变更区的降级为 file 级；文件不在
  diff 记 unmatched）。
- 终端摘要新增 📋 统计行；HTML 报告 hunk 内嵌 OCR 发现框（severity 着色、
  category chip、行号），汇总卡片计数。
- 测试 20 → 28：ocr 解析/钉住/降级/未匹配 6 个，引号路径 1 个，
  failOnViolations 单测 1 个。版本 0.3.0。

### 决策记录
- **解析必须宽容**：OCR 输出是别人家的格式，版本会漂；键名做归一化
  （path/file/filename、start_line/line、content/message/body），宁可少钉
  不要崩。
- **钉不住的评论不丢**：降级到文件级展示（ocrUnpinned），跨文件完全不匹配的
  计数并提示——信息只降级，不静默消失。

### 踩坑
- `diff --git "a/x y.ts" "b/x y.ts"` 引号路径：原正则贪婪回溯把尾部引号吃进
  路径（`x.ts"`），拆成"引号/非引号"两个正则先引号后普通，加测试锁定。
- 端到端验证时临时文件写到 git-bash 的 /tmp（node 读不到）——用户 AGENTS.md
  早有规矩"临时文件用显式盘符"，自己踩了自己人的坑。

## 2026-09-16 · 会话 3：批量评测与第一轮调优

### 完成
- CLI 新增 `--ref <sha>`（评测需要分析任意提交）。
- 评测台 `scripts/bench.mjs`（拉真实已合并 PR diff → 打分 → 压缩比/误报复统计，
  经隧道访问 GitHub API）+ 单 PR 探针 `scripts/probe.mjs`。
- 两轮评测 30 个真实 PR（vite/vue/axios/express/fastify/gin），数据见 docs/BENCH.md：
  误报 8 → **0**，within30 21 → **27**，中位压缩比 7.5% → **0%**，
  且抽验确认真实 fix/feature PR 仍正确亮红灯（防矫枉过正）。
- 新增 config 文件类别（×0.6，不参与 test-gap）与快照 churn 归类；测试 18 → 20。

### 决策记录
- **误报根因是 test-gap 惩罚的外溢**（配置文件 30 分基础 +25 → HIGH），
  修复方式是"类别豁免"而非降权重——test-gap 语义只对源码成立。
- **防矫枉过正检查纳入评测流程**：每轮调优必须同时看"红灯还在不在真风险上"。

### 踩坑
- bench 脚本曾打印 `+undefined`：把 HunkScore 当 Hunk 用了（两对象字段不同）。
- 首轮探针验证 gin#4702 疑似漏报，实际是正确判定（medium + 共变测试识别成功）
  ——**"0% 红"不等于漏报，先看明细再定性**。

## 2026-09-16 · 会话 2 补遗：CI 激活

- 用户续期 `.token` 增加 workflow scope（实测 X-OAuth-Scopes: repo, workflow），
  `git add -f` 补推 CI 文件（4e8368e），GitHub Actions 三矩阵首跑 **success**。
- 文档同步：HANDOFF 待办钩子销项、TESTING CI 状态更新。

## 2026-09-16 · 会话 2：v0.1.0 MVP 完成

### 完成
- 全套 MVP：`src/types.ts`（类型）、`diff.ts`（unified diff 解析器）、`score.ts`
  （启发式打分引擎 + 路径启发式）、`git.ts`（git 调用 + 浏览器打开）、
  `terminal.ts`（ANSI 终端摘要）、`reportHtml.ts`（单文件 HTML 热力图）、
  `cli.ts`（参数编排 + fail-on 门禁）。版本 0.1.0。
- 测试 18 个全绿（tests/diff、score、cli），见 docs/TESTING.md。
- 真实仓库验证：reviewheat 自身（worktree 模式，自食其果）、/e/GameManager
  （last-commit 模式，游戏脚本 68 行真逻辑 → CRIT，文档 → doc 降级）、
  /e/oss-contrib/repos/pinia（空提交 → 正确输出 No changes）。

### 决策记录
- **零运行时依赖**：npx 分发卖点 + 审计友好 + 安装快。参数解析手写（26 行），
  不引 commander；HTML 报告用 `<details>` 代替 JS 框架，单文件零外部资源。
- **文件分取最坏 hunk**：评审紧迫度由最危险处决定，平均分会稀释红色信号。
- **test-gap 惩罚只在 base risk ≥ 20 时加**：否则纯注释改动也会被 +25 抬成
  medium，产生噪音（会话内实测后修正）。
- **锁文件/生成物归 churn（×0.05）**：自食其果时发现 package-lock.json 被标
  HIGH [no-test]，演示场合会很难看，遂加 isChurnPath。
- **CJK 路径**：git 默认 core.quotepath=true 会把中文路径转八进制转义+引号，
  通过 `git -c core.quotepath=false diff` 原样输出（GameManager 实测发现）。

### 踩坑
- vitest 4 首次安装报 "Cannot find native binding"——npm 可选依赖老 bug
  （npm/cli#4828），删 node_modules + package-lock.json 重装即愈。
- score.ts 里 LEVEL_ORDER 曾误用 `import type` 导入（值导入才能运行）。
- DiffMode 类型成员曾写成 'last-commit' 导致 TS 收窄报错，统一为 'last'，
  展示层再映射为 'last-commit' 文案。

## 2026-09-16 · 会话 1：立项 + 脚手架 + GitHub 通路

### 完成
- 市场扫描（见 docs/PRODUCT.md 第二节）→ 定选题 A′（AI 生成代码的风险热力图
  审查分诊工具）。方案 B（Agent 轨迹可视化调试器）作为候选二剩。
- npm 查重后定名 reviewheat；E:\reviewheat 脚手架（git init -b main、
  tsconfig、MIT LICENSE、CI workflow、英文 README）。
- 按 E:\oss-contrib\使用说明.md 建立 GitHub 通路：SSH 隧道（ssh config 的
  `hk` 别名 + tencent_hk 密钥——手册写的 id_ed25519_osscontrib 在本机不存在）
  + `.token`（lvyanyan，repo 权限）。创建私有仓库 lvyanyan/reviewheat 并推送。
- README 增补 v0.6 独立二进制路线（回应用户"npm 只覆盖 Node 用户"的关切：
  入口三层 = npm → GitHub Action → 独立二进制，分析对象全语言）。

### 决策记录
- **先私有后公开**：MVP + demo GIF 就绪才公开，公开动作在发布日执行
  （`POST /repos` body 改 `"private":false` 或 settings 页）。
- **手工建仓走 API 而非 gh CLI**：gh 未登录；API + token 走隧道即可。

### 踩坑
- `.token` 无 `workflow` scope，推送含 CI 文件被拒 → 先 `git rm --cached`
  + 修正根提交推骨架，CI 文件留在本地（.git/info/exclude 本地排除）。
  **待用户续 token 时加勾 workflow scope 后 `git add -f` 补推。**
- `.token-own` 是 fine-grained PAT（授权清单 = 9 个老仓库），对新仓库无写权限。
- 1080 端口曾被旧隧道进程占用后死亡；重启隧道流程见 HANDOFF.md。

## 2026-09-16 · 会话 8：v0.4 `--llm` + `--tests`

### 完成
- `src/llm.ts`：env 配置解析（REVIEWHEAT_LLM_API_KEY/BASE_URL/MODEL，支持
  Ollama）、候选收集（medium 带的源码 hunk，上限 40）、单次调用批量分类、
  宽容 JSON 解析、有界结果应用（cosmetic 封顶 15 / refactor 35 / behavioral
  下限 50 / risky 下限 75，置信度 ≥0.6 才动分，全部带 🤖 标注）。
- `--tests`：对 HIGH+ 且 testGap 的文件生成测试建议文件，写入
  reviewheat-suggested-tests/（gitignore），上限 5 个。
- main 异步化（Promise 包裹 exitCode）；36 测试全绿；版本 0.4.0。
- 真实端到端：百炼 qwen3.6-flash 对 GameManager@5453334 跑 `--tests`，
  生成 143 行 vitest（正确 mock 微信 wx 全局、覆盖安全区计算边界），
  留档 demo/GameRoot.test.ts。

### 决策记录
- **LLM 只碰 medium 带**：critical 已经红了不用确认，low 不值得花 token；
  分类结果有界调整（不上调到超过 heuristic 的强信号），且每个调整带 reason。
- **无 --api-key CLI 参数**：argv 会进 shell history/进程列表，安全红线。
- 测试生成定位为"建议起点"而非成品：LLM 生成的测试需要人工过目，
  目录独立 + gitignore，避免污染用户仓库。

### 踩坑
- buildHelp 模板字符串里未转义反引号，第二次踩同一坑（ ingrained 了：
  写帮助文本先想转义）。
- 测试 fixture 想造 medium hunk：全行为变更 30 分 + test-gap 25 = HIGH，
  medium 需要混合行为/注释行——写 fixture 前先手动过一遍打分公式。
