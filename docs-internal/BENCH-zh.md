# reviewheat 批量评测记录（BENCH）

> 评测台：`scripts/bench.mjs`（拉取主流开源仓库最新已合并 PR 的 diff → 打分引擎 →
> 压缩比与疑似误报统计）。单 PR 明细探针：`scripts/probe.mjs <owner/repo> <pr号>`。
> 评测通过 oss-contrib SOCKS 隧道访问 GitHub API。
> 核心指标 **压缩比** = HIGH/CRITICAL 文件的新增行数 / 全部新增行数
> （产品承诺：中位数 < 30%，见 docs/PRODUCT.md 第七节）。

## 评测样本

- 第 1、2 轮（各 30 PR）：vitejs/vite、vuejs/core、axios/axios、expressjs/express、
  fastify/fastify、gin-gonic/gin
- 第 3 轮（50 PR）：上述 6 仓库 + pydantic/pydantic、denoland/deno、redis/redis、
  colinhacks/zod（Python / Rust / C / TS 强类型生态加入）

## 第 1 轮（v0.1.0 原始权重，2026-09-16）

| 指标 | 值 |
|---|---|
| 样本 | 30 PR |
| 中位压缩比 | 7.5% ✅ |
| 压缩比 ≤30% 的 PR | 21/30 |
| 疑似误报（HIGH+ 打在文档/配置上） | **8 个 PR** ❌ |

误报模式（全部同一根因）：
- `package.json` 版本号/模板批量改动（vite release PR 误报 74%）
- `.github/workflows/*.yml` 新增/依赖升级（express CI PR 误报 100%）
- 根因：这些文件不是测试也不在豁免名单 → 吃了 test-gap +25 惩罚，
  基础分 30 → 55（HIGH）。

疑似漏报排查：gin#4702（真实 fix，0% 红）经探针核实为**正确判定**——
context.go 拿 30 medium，且引擎正确识别了共变的 context_test.go。

## 调优动作

1. 新增 **config 文件类别**（`isConfigPath`：json/yaml/toml/ini 等结构化配置、
   `.github/`、Dockerfile/Makefile、go.mod/requirements.txt 等依赖清单）：
   ×0.6 降权、不参与 test-gap，终端与报告标注 `[config]`。
2. 快照文件（`__snapshots__/`、`*.snap`）归入 churn（×0.05）。
3. CLI 新增 `--ref <sha>`（评测台需要分析任意提交；也是通用能力）。

## 第 2 轮（调优后，2026-09-16）

| 指标 | 第 1 轮 | 第 2 轮 |
|---|---|---|
| 中位压缩比 | 7.5% | 0%（典型 PR 零打扰） |
| 压缩比 ≤30% | 21/30 | **27/30** |
| 压缩比 ≤50% | 25/30 | **29/30** |
| 疑似误报 | 8 | **0** ✅ |

红灯是否还亮在真东西上？（防矫枉过正检查）
14/30 PR 仍有红灯，抽验全部正确：
- vitejs/vite#23446 feat(build) preload 性能优化 → 95%，红在
  `importAnalysisBuild.ts` ✅
- vuejs/core 三个 runtime-vapor 水合修复 → 38%/40%/15%，红在 `vShow.ts`/
  `prop.ts` ✅
- expressjs/express#7459 ETag 修复 → 29%，红在 `response.js` ✅
- fastify 三个 perf PR → 6-12%，红在 `validation.js`/`content-type-parser.js` ✅
- axios#11194 fetch 缓存修复 → 5%，红在 `fetch.js` ✅

## 第 3 轮（扩充到 10 仓库 50 PR，2026-09-16）

| 指标 | 第 2 轮（30 PR） | 第 3 轮（50 PR） |
|---|---|---|
| 中位压缩比 | 0% | **5.4%** ✅ |
| 压缩比 ≤30% | 27/30 | **39/50** |
| 压缩比 ≤50% | 29/30 | **43/50** |
| 疑似误报 | 0 | **0** ✅ |

跨语言（Python/Rust/C 新增）无系统性误报，config/churn 豁免规则稳定。
AI-heavy 仓库样本仍未专门覆盖（列入发布后迭代）。

## 已知取舍（记录在案）

- 配置文件降权意味着 package.json 依赖升级的供应链风险信号变弱——v0.1 接受，
  计划 v0.3+ 加专门的"依赖 diff"因子（结合 OSV/咨询库）。
- 样本偏向主流活跃仓库；发布前再补一轮 AI-heavy 仓库（Claude Code/Copilot
  高频使用的小型仓库）的评测。
