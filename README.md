# AI / Agent 漫画信息图 GIF 生成流水线

本项目实现了从技术文章到漫画风解释 GIF 的自动化流程：LLM 负责阅读全文、规划章节和生成结构化分镜，本地程序负责准确排版、局部动画与 GIF 渲染。

![DeepSeek 端到端生成示例](output/final_demo/01-problem-unstructured-memory.gif)

## 推荐阅读顺序

1. [RESEARCH_PROCESS.md](RESEARCH_PROCESS.md)：问题、第一阶段原型、参考 GIF 分析、技术路线比较，以及为什么最终选择两阶段 LLM 流水线。
2. [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)：最终系统架构、DeepSeek/OpenAI 接入、真实验证结果、运行方法、文件结构和限制。

```text
Research Process：我们为什么这样设计
                    ↓
Project Summary：我们最终实现了什么
```

## 两阶段演进

第一阶段用 Canvas + GIFEncoder 验证了 Agent 可以生成可执行动画，但画面偏深色理工风：

![第一阶段 Cross-Attention Masking 原型](research_assets/cross_attention_prototype.gif)

第二阶段分析 LinkedIn 参考 GIF 后，改为“LLM 内容规划 + 统一漫画模板 + 确定性程序渲染”。最终版本已经使用 DeepSeek 完成真实的全文规划和 storyboard 生成，并输出四张连续 GIF。

## 快速运行（DeepSeek）

```powershell
cd C:\Users\shackelten\gif_test
npm.cmd install
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
$env:LLM_PROVIDER="deepseek"
$env:LLM_MODEL="deepseek-v4-flash"
npm.cmd run llm -- .\examples\long_article.md .\output\my_test --plan-only
```

检查 `output/my_test/plan.json` 后运行完整流程：

```powershell
npm.cmd run llm -- .\examples\long_article.md .\output\my_test
```

不要把真实 API Key 写入源代码、Markdown、`.env.example` 或 Git 提交。

## 关键文件

| 文件 | 作用 |
|---|---|
| `generate_with_llm.mjs` | DeepSeek/OpenAI 两阶段 LLM 内容规划 |
| `comic_pipeline.js` | 本地漫画排版与 GIF 渲染器 |
| `output/final_demo/` | DeepSeek 真实端到端示例及中间 JSON |
| `research_assets/` | 第一阶段原型及生成脚本 |
| `examples/long_article.md` | 测试长文章 |
| `linkedin_reference.gif` | LinkedIn 提供的风格参考 |
| `RESEARCH_PROCESS.md` | 调研与设计决策 |
| `PROJECT_SUMMARY.md` | 最终实现总结 |

老师使用自己的文章时，请直接阅读 `PROJECT_SUMMARY.md` 的“如何使用自己的文章”章节，其中给出了从放置 Markdown、检查 plan、生成 storyboard 到本地渲染 GIF 的完整命令。
