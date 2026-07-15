# AI / Agent 漫画信息图 GIF 流水线：最终项目总结

本文档承接 `RESEARCH_PROCESS.md`，集中说明调研之后真正完成的系统，包括 LLM 接入、数据流、渲染器、DeepSeek 验证结果和运行方式。

## 1. 最终成果

```text
Markdown / 纯文本文章
          ↓
LLM 调用 1：阅读全文与全局规划
          ↓
plan.json
          ↓
LLM 调用 2：生成分页 storyboard
          ↓
storyboard.json + Zod 校验
          ↓
本地 Canvas 漫画模板
          ↓
多张 GIF + manifest.json
```

当前已经实现：

- DeepSeek 和 OpenAI 双供应商 API；
- 长文章的全文规划和语义分页；
- 结构化输出和本地 Zod 校验；
- DeepSeek 空响应、非法 JSON 或字段错误时最多三次重试；
- 每页 1–3 个信息卡和中英文自适应换行；
- 粉彩漫画模板、角色浮动、箭头流动和卡片呼吸；
- 保存 `plan.json`、`storyboard.json` 和 `manifest.json`；
- 不调用 LLM 的本地规则基线。

## 2. 两阶段 LLM 设计

### 阶段一：全文规划

`generate_with_llm.mjs` 首先把全文交给模型，输出标题、主旨、受众、术语表、统一视觉设定，以及章节顺序、目的和关键要点。结果保存为 `plan.json`。

这一步解决长文章不能逐段独立生成的问题：模型必须先理解全文，才能决定哪些内容需要合并、拆分或省略。

### 阶段二：页面分镜

第二次调用只根据全局 plan 生成 storyboard。每页包含 1–3 张信息卡，每张卡包含短标题、正文和语义图标。结果由 Zod Schema 验证后保存为 `storyboard.json`。

渲染器不依赖具体模型，因此 DeepSeek 和 OpenAI 共享同一份数据契约。

## 3. DeepSeek 与 OpenAI 接入

程序通过环境变量选择供应商：

```text
DEEPSEEK_API_KEY 存在 → 默认使用 DeepSeek
否则                 → 使用 OpenAI
LLM_PROVIDER          → 可显式覆盖
```

DeepSeek 配置：

```text
Base URL：https://api.deepseek.com
默认模型：deepseek-v4-flash
输出方式：JSON Output + 本地 Zod 校验
```

OpenAI 配置：

```text
默认模型：gpt-5.6-luna
输出方式：Responses API + Zod Structured Outputs
```

两种供应商都只负责内容规划，不参与 GIF 像素渲染。

## 4. 本地渲染器

`comic_pipeline.js` 使用 `@napi-rs/canvas` 和 `gif-encoder-2`。它既能读取 Markdown/纯文本并使用本地规则生成 storyboard，也能直接渲染 LLM 或人工生成的 `storyboard.json`。

渲染器负责：粉彩背景、漫画人物、语义图标、文字换行、信息卡布局、角色浮动、箭头流动、卡片呼吸、两秒循环，以及 GIF/manifest 输出。

## 5. DeepSeek 真实验证

示例文章 `examples/long_article.md` 已完成真实 DeepSeek 两阶段调用。模型先生成全文主旨、受众、术语表、视觉设定和章节要点，再生成四页 storyboard：

1. 非结构化记忆的问题；
2. 提取前定义 ontology；
3. 实体与时间解析；
4. 可查询知识图谱的结果。

![DeepSeek 最终示例第一页](output/final_demo/01-problem-unstructured-memory.gif)

`output/final_demo/` 保留了完整链路：

```text
plan.json
storyboard.json
manifest.json
01-problem-unstructured-memory.gif
02-ontology-before-extraction.gif
03-entity-resolution.gif
04-result-queryable-graph.gif
```

即：`原文 → plan → storyboard → GIF` 全程可追踪和人工修改。

## 6. 安装与运行

安装：

```powershell
npm.cmd install
```

DeepSeek：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
$env:LLM_PROVIDER="deepseek"
$env:LLM_MODEL="deepseek-v4-flash"
```

只生成 plan：

```powershell
npm.cmd run llm -- .\examples\long_article.md .\output\my_test --plan-only
```

生成 plan 和 storyboard，但不渲染：

```powershell
npm.cmd run llm -- .\examples\long_article.md .\output\my_test --no-render
```

完整运行：

```powershell
npm.cmd run llm -- .\examples\long_article.md .\output\my_test
```

复杂文章可切换 `deepseek-v4-pro`。所有 Key 都只能设置在本地环境变量中。

## 7. 如何使用自己的文章

老师或其他使用者不需要修改 JavaScript，只需准备一篇 UTF-8 Markdown 或纯文本文章，并把文件放入项目目录。推荐结构：

```text
ai-comic-gif-pipeline/
└─ articles/
   └─ my_audio_ai_paper.md
```

Markdown 最好保留清晰标题：

```markdown
# 文章标题
## 问题背景
正文……
## 方法
正文……
## 实验与结论
正文……
```

### 7.1 安装并设置 DeepSeek

```powershell
cd C:\Users\shackelten\gif_test
npm.cmd install
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
$env:LLM_PROVIDER="deepseek"
$env:LLM_MODEL="deepseek-v4-flash"
```

依赖通常只需安装一次；环境变量只在当前 PowerShell 窗口有效。不要把 Key 写进项目文件。

### 7.2 只生成全文规划

```powershell
npm.cmd run llm -- .\articles\my_audio_ai_paper.md .\output\my_audio_ai_paper --plan-only
```

检查生成的 `output/my_audio_ai_paper/plan.json`，确认主旨、章节、专业术语、内容取舍和视觉比喻。这样可避免规划错误时继续进行第二次 API 调用。

### 7.3 生成 storyboard，但不渲染

```powershell
npm.cmd run llm -- .\articles\my_audio_ai_paper.md .\output\my_audio_ai_paper --no-render
```

程序会生成 `plan.json` 和 `storyboard.json`。建议检查每页是否只有 1–3 张卡片、标题是否简短、正文是否适合信息图。必要时可直接人工修改 JSON。

注意：重新执行 `--no-render` 会再次调用 LLM。如果只想渲染已修改的 storyboard，应使用下一条本地命令。

### 7.4 本地渲染已确认的 storyboard

```powershell
node .\comic_pipeline.js .\output\my_audio_ai_paper\storyboard.json .\output\my_audio_ai_paper
```

这一步完全在本地运行，不调用 LLM，也不会产生 API 费用。输出包括 `manifest.json` 和连续编号的 GIF。

### 7.5 一条命令完成全部流程

如果不需要中途检查：

```powershell
npm.cmd run llm -- .\articles\my_audio_ai_paper.md .\output\my_audio_ai_paper
```

它会依次执行：`全文规划 → storyboard → 本地 GIF 渲染`。第一次处理专业文章时，推荐采用 `--plan-only → --no-render → 本地渲染` 三步流程。

### 7.6 切换质量与成本

普通文章使用：

```powershell
$env:LLM_MODEL="deepseek-v4-flash"
```

长篇或专业性较强的文章可切换：

```powershell
$env:LLM_MODEL="deepseek-v4-pro"
```

### 7.7 常见问题

- `Cannot find package 'openai'`：运行 `npm.cmd install`；
- `Missing DEEPSEEK_API_KEY`：在当前 PowerShell 重新设置 Key；
- JSON 连续三次校验失败：检查文件编码、缩短输入，或改用 `deepseek-v4-pro`；
- GIF 不满意但 storyboard 正确：修改 storyboard 后本地重渲染，不必再次调用 LLM；
- 文章非常长：优先选择论文中需要解释的核心章节，或按自然章节拆成数篇。

## 8. 目录结构

```text
ai-comic-gif-pipeline/
├─ README.md
├─ RESEARCH_PROCESS.md
├─ PROJECT_SUMMARY.md
├─ generate_with_llm.mjs
├─ comic_pipeline.js
├─ package.json
├─ package-lock.json
├─ .env.example
├─ linkedin_reference.gif
├─ examples/long_article.md
├─ research_assets/
│  ├─ cross_attention_prototype.js
│  └─ cross_attention_prototype.gif
└─ output/final_demo/
   ├─ plan.json
   ├─ storyboard.json
   ├─ manifest.json
   └─ 01...04-*.gif
```

`node_modules` 不纳入项目，可通过 `npm.cmd install` 重建。

## 9. 已验证项目

- DeepSeek 真实两阶段 API 调用成功；
- `plan.json`、`storyboard.json` 和四张 GIF 成功生成；
- DeepSeek JSON 输出经过本地 Schema 校验；
- 无 Key 时安全退出；
- Node 24 环境安装和渲染成功；
- `npm audit` 为 0 个漏洞；
- 项目中没有 API Key。

## 10. 当前限制

- 目前只有一种主要漫画版式；
- 人物和图标的精细程度仍低于专业插画；
- 尚未自动调用视觉模型检查关键帧；
- GIF 文件较大，批量发布更适合 MP4/WebM；
- 专业论文仍需人工检查 LLM 的内容取舍。

## 11. 后续方向

1. 增加 before/after、分层和循环等模板；
2. 建立统一 SVG 漫画资产库；
3. 自动抽取关键帧并进行视觉评分；
4. 只重排或重绘失败页面；
5. 迁移到 Remotion + SVG，支持 MP4、字幕和音频；
6. 使用真实论文继续验证准确性和跨页一致性。

## 12. 最终结论

项目证明：技术漫画 GIF 可以由 AI / Agent 高效辅助生成，但可靠方案不是让模型直接预测整段视频，而是让 LLM 负责内容理解和结构化决策，让模板与程序负责视觉准确性和可复现性。

> LLM 负责理解和取舍，插画资产负责亲和力，程序负责准确与稳定。
