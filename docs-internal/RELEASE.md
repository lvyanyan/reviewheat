# 发布日手册（RELEASE）

> 三篇文案 + 转公开清单。发布日操作人：仓库主人本人（账号信誉原因，AI 不代发）。
> 文案由 AI 起草，发布前通读一遍、按当时状态微调数字。
> 最后更新：2026-09-16（基于 v0.3.1 + 50 PR 评测数据）。

## 一、转公开清单（发布日按序执行）

1. 发布前检查（一次性）：
   - [ ] README 渲染检查（GIF 加载、徽标、链接）
   - [ ] `npm test` 全绿、CI 全绿
   - [ ] 全库扫一遍确认无密钥（我们的 key 从未入库 ✓）
   - [ ] 仓库描述设置："Risk heatmap for pull requests — review the 5% of AI-generated code that matters"
   - [ ] topics：`code-review` `ai` `llm` `heatmap` `developer-tools` `diff` `testing`
2. 转公开（二选一）：
   - Settings → General → Danger Zone → Change visibility → Public
   - 或 API：`PATCH /repos/lvyanyan/reviewheat` body `{"private":false}`
3. 发布时刻（北京时间）：**周二至周四 20:00–22:00**（美东早上 8–10 点，Show HN 黄金档）
4. 发帖顺序：Show HN 先发 → 10 分钟后 Reddit r/opensource → 同晚 V2EX 分享创造
5. 发布后 48h：守评论区（下有应答模板）、issue 快速响应、盯 Trending 与 star 曲线

## 二、Show HN

**标题**（只一句，不煽情）：

```
Show HN: Reviewheat – a risk heatmap for AI-generated PRs
```

**首评（发帖人自己的说明，HN 惯例）**：

```
Hi HN! We're drowning in agent-generated code: my PRs routinely run 500-1500
lines now, and AI reviewers respond with even more comments. The bottleneck
moved from writing code to reviewing it.

reviewheat attacks the other side: instead of generating more review text,
it compresses what a human has to read. It scores every hunk of a diff with
deterministic, offline heuristics — behavioral change vs cosmetic churn,
control-flow and API-definition hits, complexity delta, deletions, and
whether any test file changed alongside — then renders a heatmap so you read
the 5% that matters and skim the rest.

It does NOT judge correctness (compilers catch syntax, humans/AI judge
semantics). It's the triage nurse, not the doctor.

One command: `npx reviewheat` in any git repo (any language — it reads the
diff, not your stack). Zero dependencies, no API key required.

It also overlays your AI reviewer's findings: `--ocr` pins open-code-review
JSON onto the same heatmap (works with `--with-ocr` in one command), so the
comments land where a human is actually looking.

I benchmarked the scorer on 50 real merged PRs across vite, vue, axios,
express, fastify, gin, pydantic, deno, redis and zod: median "lines to
review" was ~5% of additions, and zero false alarms on docs/config/lockfile
churn. Methodology and numbers: docs/BENCH.md in the repo.

Known limits: it's a heuristic, not semantics — it tells you where to look,
not whether it's right. Windows/macOS/Linux via Node >= 20.

Repo: https://github.com/lvyanyan/reviewheat
Happy to answer anything about the scoring model.
```

## 三、Reddit（r/opensource；注意 r/programming 只收文章不发项目，勿投）

> ⚠️ **2026-09-16 实测**：r/opensource 要求账号注册满 1 年才能发帖（automod 秒删、
> 明示不予例外），u/zuoqing 新号被删帖。改投无门槛版块，同文案可直接用：
> - r/SideProject：https://www.reddit.com/r/SideProject/submit （对新号最友好）
> - r/coolgithubprojects：https://www.reddit.com/r/coolgithubprojects/submit
> - ⚠️ 勿向 r/opensource 重发（可能升级为封禁）；账号日常养成熟练度后再进。

**标题**：

```
I open-sourced a tool that turns AI-generated PRs into a risk heatmap, so I review 5% instead of 100%
```

**正文**：

```
Like a lot of you, my coding agent now writes most of my PRs — and I caught
myself rubber-stamping huge diffs because reading them all didn't scale.
AI reviewers didn't help; they added more comments to read.

So I built reviewheat (MIT, CLI, zero deps, no API key): it scores every
hunk of a diff with offline heuristics — real behavioral change vs cosmetic
churn, control-flow hits, complexity delta, deletions, and test co-change —
and prints a heatmap. You review the red, skim the green.

- Works on any language (it reads the git diff, not your stack)
- `npx reviewheat` in any repo, or --diff-file for a raw .diff
- Optional: overlays open-code-review findings (--with-ocr, one command)
- Optional: BYO-LLM for behavior classification (works with local Ollama)
- CI gate: --fail-on high exits 1 if a high-risk file has no co-changed test

I benchmarked the scorer on 50 real merged PRs (vite, vue, deno, redis,
pydantic, zod, express, ...): median lines-to-review ≈ 5% of additions,
zero false positives on config/doc/lockfile churn. Full methodology in
docs/BENCH.md.

It deliberately does not judge correctness — it's triage for your attention,
not another robot reviewer.

Repo + GIF demo: https://github.com/lvyanyan/reviewheat

Feedback welcome, especially on the scoring weights (they're documented and
easy to argue with).
```

## 四、V2EX（分享创造节点）

> ⚠️ **2026-09-16 实测**：V2EX 新注册需邀请码（2024 年 5 月后 Google 注册的新号
> 要激活码）或持有 10K V2EX Coin 的 Solana 路线，当天走不通。无老账号时的替代：
> - **掘金** juejin.cn（手机号注册）：发短文贴 GIF
> - **HelloGitHub** hellogithub.com：提交项目收录（对 star 长尾最有效）
> - 若有老账号：用页面上"从这里登入"的邮箱入口找回即可正常发帖。

**标题**：

```
[分享创造] agent 写的 PR 越来越看不过来了，我写了个风险热力图工具 reviewheat
```

**正文**：

```
背景：现在我的 PR 基本都是 Claude Code / Cursor 写的，动辄上千行。
人肉逐行读不现实，AI 审查工具（CodeRabbit 之类）又是往 PR 里加更多评论——
评论越多的结果就是更没人看。

所以我换了个思路做了 reviewheat（MIT、CLI、零依赖、不需要 API key）：
不产出任何审查意见，只回答一个问题——**这 900 行里，哪 30 行值得我认真看**。

原理很朴素：diff 本身就是文本，大部分"危险信号"不需要理解语义就能判断——
控制流关键词、API 定义变更、圈复杂度增量、纯删除、有没有测试跟着改、
是不是纯格式化。每个 hunk 打分排序，红的认真读，绿的扫一眼。

用法：

    npx reviewheat                 # 任何 git 仓库，任何语言，秒级出热力图
    npx reviewheat --with-ocr      # 一条命令：自己跑阿里的 open-code-review 并把
                                   # 它的评论按行号钉到热力图上（互补，不是竞品）

在 vite / vue / deno / redis / pydantic / zod 等仓库的 50 个真实已合并 PR 上
测过打分器：中位"需精读行数"约占新增行数 5%，配置/文档/锁文件零误报，
方法论在仓库 docs/BENCH.md。

它不判断代码对不对（那是编译器、测试和人的事），只做注意力分诊——
像急诊室的分诊台，不做诊断。

仓库（含 GIF 演示）：https://github.com/lvyanyan/reviewheat

欢迎拍砖，尤其是打分权重那块——权重全部文档化，很好反驳。
```

## 五、评论区应答模板（发布日省时间用）

- **"How is this different from CodeRabbit / OCR?"**
  → They generate review comments; we generate the reading order. Complementary —
  `--with-ocr` literally overlays their findings on our heatmap.
- **"Heuristics can't understand semantics."**
  → Correct, and stated in the README. We rank where human judgment goes; the
  judgment is still yours (optionally assisted by `--llm`, BYO key, local Ollama works).
- **"Does it send my code anywhere?"**
  → No. Default mode is fully offline. The only network calls are the ones you
  explicitly opt into (--with-ocr runs YOUR configured OCR/LLM; --llm uses YOUR key).
- **"Why not just read the diff?"**
  → On a 40-line PR, sure. On the 900-line agent PR from last night, the heatmap
  is the difference between reviewing and rubber-stamping.
- **"Does it work on language X?"**
  → It reads unified diffs, so yes. Language-specific signals (test naming
  conventions) cover the mainstream families; PRs welcome.

## 六、掘金文章（替代 V2EX 的国内主渠道）

> 发布入口：juejin.cn 注册后"写文章"。GIF 图发布时在编辑器上传
> `docs/img/demo.gif`（或直接引用 GitHub raw 地址），代码块用 markdown。

**标题**：

```
Agent 写的 PR 越来越审不动了，我开源了一个"风险热力图"工具：reviewheat
```

**正文**：

```markdown
## 背景：审不动了

现在我的日常是这样的：丢一个需求给 Claude Code，几分钟后收到一个 900+ 行的 PR。

写是真快，但代码还是要人背的——逐行读不现实，直接 merge 又心虚。
更糟的是 AI 审查工具（CodeRabbit 之类）的解法是往 PR 里**加更多评论**：
评论越多，人越不看。

瓶颈早就不是"写代码"，而是"审代码"。

于是我换了个思路写了个工具：**reviewheat**（MIT，CLI，零依赖，不需要 API key）。
它不产出任何审查意见，只回答一个问题：

> 这个 900 行的 PR 里，哪 30 行值得我认真看？

## 原理：diff 本身就是文本，大部分危险信号不需要理解语义

对每个改动块（hunk）跑一组离线启发式：

| 文本信号 | 推断 |
|---|---|
| 行首是注释或 trim 后为空 | 格式化/文档改动，零风险 |
| 增删行的 trim 集合完全相同 | 纯重排版，整块降噪 |
| 含 if / return / throw / => | 控制流变更，程序行为被重排 |
| 含 function / class / export | API 表面变更，波及调用方 |
| && / \|\| / ?? 数量变化 | 布尔逻辑翻转 |
| 纯删除无替换 | 删除也会改变行为 |
| 同 diff 里没有任何测试文件共变 | 测试缺口，加惩罚分 |

每个 hunk 得到 0-100 的风险分，红的认真读，绿的扫一眼。
权重全部文档化（仓库 docs/PRODUCT.md），欢迎来反驳。

## 效果

（此处插入 demo GIF）

在 vite / vue / deno / redis / pydantic / zod 等 10 个仓库的 50 个真实已合并
PR 上测过打分器：**中位"需精读行数"约占新增行数的 5.4%，配置/文档/锁文件
零误报**。方法论和数据都在仓库 docs/BENCH.md。

它不判断代码对不对（那是编译器、测试和人的事），只做注意力分诊——
像急诊室的分诊台，不做诊断。

## 用法

任何 git 仓库、任何语言（它读的是 diff，不是技术栈）：

    npx reviewheat                    # 秒级出热力图，自动打开 HTML 报告
    npx reviewheat --with-ocr         # 一条命令：跑阿里的 open-code-review 并把
                                      # 它的评论按行号钉到热力图上（互补不是竞品）
    npx reviewheat --fail-on high     # CI 门禁：高危区没测试就挂

默认完全离线、零配置；想接 LLM 也支持自带 key（包括 Ollama 本地模型）。

## 开源地址

https://github.com/lvyanyan/reviewheat

觉得有用的话求个 star，更欢迎来 issue 区拍砖——尤其是打分权重，
很好反驳，反驳过来我就调。
```

## 七、HelloGitHub 提交文案

> 发布入口：hellogithub.com 登录后"提交项目"。语言选 TypeScript。

- **项目地址**：`https://github.com/lvyanyan/reviewheat`
- **项目简介**（表单用）：

```
AI 编码代理生成的 PR 越来越大，人工逐行审查跟不上。reviewheat 用离线启发式
给 PR 的每个改动块打风险分——行为变更 vs 格式化噪音、控制流命中、复杂度增量、
测试共变——生成热力图，让人只精读真正危险的 5%。零依赖、不需要 API key，
支持叠加 open-code-review 的审查结果和 CI 门禁模式。
```

- **一句话版**（如果表单限字数）：`把 AI 生成的巨型 PR 变成风险热力图，圈出真正需要人工精读的改动。`

## 八、HN 限制应对（2026-09-16 20:00 实测）

新账号被 HN 临时限制 Show HN（官方政策，非针对个人）。正规路径按序：
1. **邮件 dang@ycombinator.com**（草稿见同目录 dang-email.txt，填上 HN 用户名
   后发送）——版主 responsive，好项目甚至会亲自代发或排期；
2. 找有老号的朋友/同事提交（作者本人正常参与评论区即可；**严禁组织投票**）；
3. 养号 1-2 周：真诚参与其他帖子的讨论攒 karma，再自行发 Show HN；
4. ⚠️ 勿用 Ask HN 变体规避限制，勿买/借无关账号发帖——都是封号级红线。
今晚先走 Reddit r/SideProject + 掘金 + HelloGitHub，HN 作为后续事件单独执行。

### 2026-09-16 20:10 补充：Reddit 站级过滤器同样拦截

r/SideProject 帖子被 Reddit 全站垃圾过滤器移除（非版块规则）。至此三大英文
渠道对新账号全部关死。调整：
- 今晚软启动改为中文渠道：掘金文章 + HelloGitHub 提交收录；
- dang 邮件已起草（dang-email.txt）；u/zuoqing 与 HN 新号进入 1-2 周养号期
  （只做真诚评论，零自荐），HN Show HN 推迟到养号完成后执行；
- r/SideProject 可选：modmail 礼貌申诉（过滤器误判有人工放行先例），低预期；
- ⚠️ 48h 内勿再从 u/zuoqing 发任何自荐帖，连续触发过滤会升级为账号处罚。

