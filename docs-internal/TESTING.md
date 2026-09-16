# reviewheat 测试留档（TESTING）

> 政策：每个功能合入必须带测试；权重/阈值改动必须同步调整断言并记录在案。
> 运行方式：仓库根目录 `npm test`（vitest run，全量离线，秒级）。
> CI：`.github/workflows/ci.yml`（Node 20/22/24 矩阵）——✅ 已推送并激活，
> 首跑 success（2026-09-16，commit 4e8368e）。

## 覆盖范围

| 测试文件 | 覆盖对象 | 用例数 |
|---|---|---|
| tests/diff.test.ts | unified diff 解析：多文件、多 hunk、new/binary/renamed、hunk 头省略行数、CRLF、引号空格路径 | 6 |
| tests/score.test.ts | 打分因子（行为/控制流/纯重排/纯删除/test 缩放）、路径启发式（test/doc/churn/config/快照）、测试共变推断、config 免 test-gap 回归、analyze 聚合 | 13 |
| tests/ocr.test.ts | OCR JSON 宽容解析（信封/裸数组/坏条目/前置杂散输出）、钉到 hunk、文件级降级、unmatched 统计 | 7 |
| tests/cli.test.ts | VERSION 与 package.json 同步、help 完整性、failOnViolations 判定 | 3 |

批量评测（真实 PR 端到端）另见 docs/BENCH.md：30 PR × 2 轮。

## 运行记录

| 日期 | commit | 结果 | 备注 |
|---|---|---|---|
| 2026-09-16 | （v0.1.0 提交前） | 18/18 通过，build 零报错 | 首次全绿 |
| 2026-09-16 | （v0.1.0 提交前） | 17/18 → 修复后 18/18 | 3 个失败：fixture 断言漏算第二 hunk、test 缩放断言过严、候选测试路径缺 `__tests__/原名` 惯例 |
| 2026-09-16 | （v0.1.0 提交前） | 5/17 失败 | 过程记录：LEVEL_ORDER 误用 type 导入、package.json 未同步 0.1.0 |
| 2026-09-16 | （评测调优提交前） | 20/20 通过 | 新增 config/快照启发式 + config 免 test-gap 回归用例 |
| 2026-09-16 | （v0.3.0 提交前） | 26/28 → 修复后 28/28 | 引号路径正则贪婪回溯 bug（拆双正则）；failOn 断言写死 high 实为 critical |
| 2026-09-16 | （v0.3.0 提交前） | 端到端 2 例 | --ocr 钉住（README.md L8-11 → hunk 内 ✓ + HTML ocritem 渲染 ✓）；指向 diff 外文件 → "not in this diff" ✓ |
| 2026-09-16 | （v0.3.1 提交前） | 29/29 通过 | 新增前置杂散输出容错用例 |
| 2026-09-16 | （v0.3.1 提交前） | 端到端 1 例 | --with-ocr 用假 ocr.cmd shim 验证 spawn→落盘→解析→钉住→HTML 渲染全链路 ✓ |
| 2026-09-16 | （发布前） | **真实 OCR 产物联调 ✓** | OCR v1.12.4 + 百炼 qwen3.6-flash 真跑 GameManager@5453334（3m48s，4 条真实发现）→ reviewheat --ref 同 commit --ocr 叠加：4/4 钉住、0 丢失；真实数据中 severity=undefined 的条目由宽容解析正确兜底 |

## 真实仓库自食其果（dogfood）记录

| 日期 | 目标 | 模式 | 结果 |
|---|---|---|---|
| 2026-09-16 | reviewheat 自身 | worktree | ✅ 自身 MVP 改动 CRIT，package-lock 正确降级 [churn] |
| 2026-09-16 | /e/GameManager | last-commit | ✅ 游戏脚本 +68/-20 → CRIT [no-test]；两个 .md → doc 降级；**发现并修复 CJK 路径 bug** |
| 2026-09-16 | /e/oss-contrib/repos/pinia | last-commit | ✅ 空提交正确输出 "No changes in the last commit." |

## 已知未覆盖（后续补）

- ~~真实 OCR 产出的端到端联调~~ ✅ 2026-09-16 完成（百炼 qwen3.6-flash 真跑，
  见运行记录表）
- HTML 报告无快照测试（v0.2 计划：核心结构断言 + 关键转义用例）
- `--fail-on` 未有端到端测试（判定逻辑已单测，临时仓库 e2e 待补）
- 引号路径（`"a/with space/x.ts"`）已覆盖 ✅（2026-09-16）
| 2026-09-16 | （v0.4.0 提交前） | 36/36 通过 | 新增 llm.test.ts（配置解析/宽容解析/候选收集/有界应用/test 映射）7 用例 |
| 2026-09-16 | （v0.4.0 提交前） | 真实端到端 ✓ | 百炼 qwen3.6-flash：GameManager@5453334 --tests 生成 143 行 vitest（demo/GameRoot.test.ts 留档）；--llm 在该提交无 medium 候选（正确空跑） |
