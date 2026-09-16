# reviewheat 产品文档

> 产品唯一权威说明。对外门面是 README.md（英文）；本文档是中文完整版，含决策依据。
> 创建：2026-09-16。最近更新：2026-09-16。

## 一、定位

**一句话**：Your agents write 80% of the code. Review it in 10% of the time.

**产品形态**：CLI 工具。输入任意 git diff（工作区/最近提交/PR），输出风险热力图——
哪些文件、哪些 hunk 含真实行为变更且没有测试覆盖。**不产生任何评审评论**，只做
"人类审阅者的分诊界面"。

**目标用户（ICP）**：使用 AI 编码代理（Copilot / Claude Code / Cursor / Trae）之后
PR 体量爆炸、人审不过来的开发者与小团队。全语言适用（分析对象是 git diff，
与编程语言无关）。

## 二、立项依据（2026-09-16 市场扫描）

1. **痛点公认**：HN 帖 "There is an AI code review bubble"（2026-01，351 分 / 249 评论）
   确立共识：生成速度 > 人类审查速度；同一社区又在 "AI 审查机器人净留 nitpick 评论"
   帖（257 分）表达对"更多评论"路线的厌恶。两个痛点合并 = 我们的切口：
   **人不需要更多评论，人需要知道该看哪里**。
2. **赛道被验证但位置有缝隙**：阿里 2026-05 开源 open-code-review（OCR），
   4 个月 29,491 star（截至 2026-09-16 实测 API），但其输出是行级文字评论 +
   简单 Session Viewer（回放/标记），**没有任何面向人的可视化分诊**。
3. **决策**：不做"又一个 AI 审查器"（与 29K star 品牌正面竞争无胜算），
   做 OCR 的**互补可视化层**：`--ocr` 直接吃 OCR 的 JSON 输出钉到热力图上，
   站在赢家的流量井里。

### 竞品速览

| 产品 | 形态 | 收费 | 解决"人审不过来"？ |
|---|---|---|---|
| CodeRabbit | SaaS 机器人评论 | $12-30/人/月 | 否（更多评论） |
| Qodo (PR-Agent) | SaaS + 开源 CLI | 免费+付费 | 否 |
| open-code-review | 开源 CLI（阿里） | 免费 | 否（精确评论，无分诊） |
| Greptile / GitLab Duo | SaaS | 收费 | 否 |
| **reviewheat** | 开源 CLI + 可视化报告 | 免费 | **是（压缩必读行数）** |

## 三、风险模型（公开、确定性、可解释）

每个 hunk 独立打分，因子与权重（`src/score.ts` 内 `W` 常量，改权重必须同步本文档）：

| 因子 | 权重 | 含义 |
|---|---|---|
| behavioral-churn | 0.30 | 新增行中非注释/非空行占比 |
| control-flow | 0.25 | if/for/return/throw/=> 等（×2 归一后封顶） |
| definition-change | 0.20 | function/class/interface/export 等定义行变更（增或删） |
| logic-operators | 0.10 | &&/||/??/=== 布尔逻辑变化 |
| complexity-delta | 0.15 | 分支点（if/&& 等）净增数 /6 封顶 |
| deletion-only | 0.30 | 纯删除无替换（删除也会改变行为） |

修正规则：
- **test-gap**：源文件在本 diff 中无任何共变测试文件（命名惯例推断，见
  `candidateTestPaths`）→ risk ≥ 20 时 +25；
- **test 文件 ×0.4**、**doc 文件 ×0.5**、**config 文件 ×0.6**（json/yaml/toml 等
  结构化配置、`.github/`、Dockerfile/Makefile、go.mod/requirements.txt 等依赖
  清单；不参与 test-gap）、**churn（锁文件/快照/CHANGELOG/LICENSE）×0.05**；
- **pure-reformat**（增删行 trim 后集合相同）→ 封顶 5；
- 等级阈值：<25 low，<50 medium，<75 high，≥75 critical；
- 文件分 = 最危险 hunk 的分（评审紧迫度由最坏处决定）。
- 依据：30 真实 PR 批量评测（docs/BENCH.md）——配置文件曾被 test-gap 惩罚
  系统性误报为 HIGH。

## 四、CLI 契约

```
reviewheat                     # 分析工作区未提交改动（默认）
reviewheat --last              # 分析最近一次提交
reviewheat --ref <sha>         # 分析任意提交（<sha>~1..<sha>）
reviewheat --diff-file <f>     # 分析任意 unified diff 文件（评测/演示/CI 管道用）
reviewheat --repo <label>      # 显示用仓库名标签（配合 --diff-file）
reviewheat --out <file>        # 报告输出路径（默认 reviewheat-report.html）
reviewheat --no-open           # 不自动打开浏览器
reviewheat --fail-on <level>   # CI 门禁：level 及以上且 testGap → exit 1
reviewheat --pr <n>            # （v0.5）分析 GitHub PR
reviewheat --ocr <file|->      # ✅ 叠加 open-code-review JSON；'-' 读 stdin 支持管道一行流
reviewheat --with-ocr          # ✅ 真单命令：自动运行 `ocr review --format json` 后叠加（显式授权烧 token）
reviewheat --llm               # （v0.4）LLM 行为分类（BYO key，OpenAI 兼容 API）
```

- 退出码：0 正常；1 `--fail-on` 命中；2 用法/环境错误。
- 输出：终端摘要（ANSI，非 TTY 自动去色）+ 单文件 HTML 报告（暗色、零外部依赖、
  红区默认展开、每 hunk 展示因子 chips）。

## 五、路线图

| 版本 | 内容 | 状态 |
|---|---|---|
| v0.1 | diff 解析 + 启发式打分 + 终端摘要 + HTML 热力图 + fail-on | ✅ 2026-09-16 |
| v0.2 | config/快照启发式调优（30 PR 评测）、--ref、评测台 | ✅ 2026-09-16 |
| v0.3 | `--ocr` 叠加 + `--with-ocr` 单命令 + `--diff-file` + README demo GIF | ✅ 2026-09-16 |
| v0.4 | `--llm` 行为分类 + 红区一键针对性测试生成 | 待做 |
| v0.5 | GitHub Action + `--pr` 模式 | 待做 |
| v0.6 | 独立二进制（macOS/Linux/Windows，免 Node） | 待做 |

## 六、发布计划（星标飞轮）

1. **冷启动弹药**：README 首屏 GIF（对真实仓库跑 --last，红绿对比 30 秒讲完）；
2. **同日三发**：Show HN（美东周二至四早）+ Reddit（r/programming、r/opensource）+
   V2EX 分享创造；文案见 docs/HANDOFF.md 发布素材小节；
3. **Trending 飞轮**：首日几百星冲日榜 → 自然流量接棒；
4. **OCR 生态位**：向 awesome 列表提交、在 OCR discussions 低调发布可视化配套；
5. **里程碑**：先 1K star（可信背书），10K 为 stretch goal。

## 七、成功指标

- **压缩比验证：批量评测达标（50 真实 PR、10 仓库、5 种语言）**——中位压缩比
  5.4%、39/50 ≤30%、配置/文档误报 0（详见 docs/BENCH.md）；
- 发布 48h 内上 GitHub Trending（TS 日榜）；
- 1 个月内 1K star；
- 发布前补一轮 AI-heavy 仓库评测（Claude Code/Copilot 高频使用的小型仓库）。
