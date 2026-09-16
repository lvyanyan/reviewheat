# AGENTS.md — reviewheat 仓库工作约定

AI 编码代理（及人类协作者）在本仓库工作时遵守以下约定。

## 项目是什么

reviewheat：AI 生成代码的风险热力图审查分诊工具。CLI，TypeScript + Node（ESM），
**零运行时依赖**。产品定位与完整规格见 `docs/PRODUCT.md`。

## 常用命令

```bash
npm test          # vitest 全量（当前 18 用例）
npm run build     # tsc，产出 dist/
npx tsx src/cli.ts --no-open   # 本地跑 CLI（在任意 git 仓库内）
```

## 结构

```
src/
  cli.ts         # 入口与参数编排；VERSION 必须与 package.json 同步（有测试锁定）
  diff.ts        # unified diff 解析器
  score.ts       # 风险因子打分（权重表见 docs/PRODUCT.md 第三节，改动需同步文档）
  git.ts         # git 调用、浏览器打开
  terminal.ts    # ANSI 终端摘要
  reportHtml.ts  # 单文件 HTML 报告
  types.ts       # 共享类型
docs/            # PRODUCT（产品）/ DEVLOG（日志）/ TESTING（测试留档）/ HANDOFF（会话交接）
tests/           # vitest，fixtures 内联字符串为主
.github/workflows/  # CI（注意：可能尚未推送，见 docs/HANDOFF.md）
```

## 硬性规则

1. **每次会话结束**：更新 `docs/DEVLOG.md`（本会话条目）、`docs/TESTING.md`
   （运行记录）、`docs/HANDOFF.md`（状态快照 + backlog）——用户三条硬性要求。
2. **提交前必须** `npm test` 全绿 + `npm run build` 零报错。
3. **提交信息**用 conventional commits（feat/fix/docs/test/chore）。
4. **权重/阈值改动**必须同步 `docs/PRODUCT.md` 并补/改对应断言。
5. **零运行时依赖**政策：不加 dependencies；开发依赖需在 DEVLOG 说明理由。
6. **密钥与 token 绝不入库**；GitHub 推送方法见 `docs/HANDOFF.md`（走隧道 + token）。
