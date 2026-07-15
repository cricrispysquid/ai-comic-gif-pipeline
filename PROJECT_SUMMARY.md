# AI / Agent 漫画信息图 GIF 流水线：项目总结

项目入口见 `README.md`；完整的调研、技术比较和迭代过程见 `RESEARCH_PROCESS.md`。

## 项目目标

本项目调研并验证了如何用 AI / Agent 高效生成类似 LinkedIn 技术文章中的漫画风信息图 GIF。参考作品不是单纯的文生视频，而是“高质量静态手绘信息图 + 克制的局部循环动画”：粉彩卡片、手写字体、漫画人物和图标负责亲和力，严格的文字、箭头与流程排版负责准确性。

最终采用的思路是：

```text
文章 / Markdown
      ↓
全文规划与语义分段
      ↓
结构化 storyboard.json
      ↓
漫画模板自动排版
      ↓
局部循环动画
      ↓
多张 GIF + manifest.json
```

## 关键结论

1. **图像模型负责“可爱”，程序负责“正确”**。人物和插画可以由图像模型生成，但正文、箭头、步骤和布局应由 SVG/Canvas/Remotion 等确定性工具处理。
2. **长文章不能逐段独立生成整张图**。应先读取全文，建立统一大纲、术语表、角色和色板，再逐章节生成分镜，否则容易产生重复、前后矛盾和风格漂移。
3. **模板与资产复用是效率核心**。真正的规模化方案应复用人物、图标、配色、版式和动画预设，而不是每篇文章从零生成。
4. **必须有渲染后检查**。本次测试就发现并修复了英文断词和四卡页面过密的问题，最终把每页限制为最多三个信息卡。

## 当前程序

核心程序为 `comic_pipeline.js`，渲染部分依赖：

- `@napi-rs/canvas`
- `gif-encoder-2`

它支持输入 Markdown、纯文本或结构化 JSON，并自动完成：

- 按 Markdown 标题保留文章语义章节；
- 将过长段落拆成句群；
- 每张图最多安排三个信息卡；
- 生成粉彩漫画风页面；
- 添加角色浮动、箭头流动和卡片呼吸；
- 输出两秒无缝循环 GIF；
- 保存中间 `storyboard.json` 和结果 `manifest.json`。

## 目录结构

```text
gif_test/
├─ comic_pipeline.js          # 核心流水线
├─ generate_with_llm.mjs      # DeepSeek/OpenAI 两阶段 LLM 规划
├─ package.json               # 命令与依赖声明
├─ package-lock.json          # 锁定依赖版本
├─ README.md                  # 项目入口和快速运行
├─ PROJECT_SUMMARY.md         # 本文档
├─ RESEARCH_PROCESS.md        # 调研和迭代过程
├─ research_assets/
│  ├─ cross_attention_prototype.js   # 第一阶段原型生成脚本
│  └─ cross_attention_prototype.gif  # 报告内嵌展示
├─ linkedin_reference.gif     # LinkedIn 参考 GIF
├─ examples/
│  └─ long_article.md         # 长文章测试输入
└─ output/final_demo/
   ├─ plan.json               # DeepSeek 全文规划
   ├─ storyboard.json         # DeepSeek 结构化分镜
   ├─ manifest.json           # 输出索引
   └─ 01...04-*.gif           # 四张最终演示结果
```

`node_modules` 不保留，因为可通过 `npm install` 重建。

## 安装与运行

在 PowerShell 中进入项目目录：

```powershell
npm install
```

运行内置长文章测试：

```powershell
npm run comic -- .\examples\long_article.md .\output\sample
```

测试自己的文章：

```powershell
npm run comic -- .\你的文章.md .\output\你的文章
```

程序也可以直接接受人工或 AI 生成的 storyboard：

```powershell
node .\comic_pipeline.js .\storyboard.json .\output\result
```

## 长文章的 AI 分段策略

推荐使用两阶段生成：

### 第一阶段：全文规划

AI 阅读全文后输出：

- 文章的一句话主旨；
- 章节及阅读顺序；
- 统一术语表；
- 应保留和应省略的信息；
- 全局人物、图标、配色和视觉比喻。

### 第二阶段：章节分镜

在全局约束下逐章节输出 1–N 页，每页包含 1–3 个信息卡。段落不是页面单位；一个段落可以拆成多个要点，多个短段也可以合并为一个叙事步骤。

当前程序用确定性规则完成这一过程，可作为不调用 AI 的基线。以后接入 LLM 时，只需让模型生成相同结构的 `storyboard.json`，渲染器无需修改。

## 已完成的验证

纯规则基线曾将示例长文章生成为五张 GIF。第一次渲染采用每页四卡，出现阅读密度过高；经过关键帧检查后改为每页最多三卡。随后接入 DeepSeek 两阶段规划，模型先输出全局 `plan.json`，再生成 `storyboard.json`，最终得到四张连续 GIF。最终交付仅保留更有代表性的 DeepSeek 版本。

## 当前限制

- 漫画人物和图标目前由 Canvas 程序绘制，风格统一但细节仍不及专业插画；
- 自动分段是启发式规则，还没有真正调用 LLM 理解重要性和叙事关系；
- 目前只有一种主要版式；
- GIF 体积较大，正式发布时更适合优先导出 MP4/WebM，再按需要转为优化 GIF；
- 暂未实现自动视觉评分和局部重排。

## 建议的下一步

1. 用一篇真实文章测试当前流水线；
2. 根据文章结果确定 storyboard JSON 的最终字段；
3. 接入 LLM 做“全文规划 + 分章节分镜”；
4. 建立统一漫画角色和 SVG 图标资产库；
5. 增加 before/after、分层结构、循环结构等模板；
6. 引入关键帧视觉检查和自动局部修复；
7. 若要批量生产，迁移到 Remotion + SVG，并默认输出 MP4。

当前版本已经证明：同一套程序可以把长文章拆成连续的漫画信息图 GIF。下一次验证的重点不再是“能不能生成”，而是 AI 对真实文章的内容取舍、叙事分段和视觉一致性是否足够好。

## LLM API 接入

`generate_with_llm.mjs` 已实现两阶段 OpenAI API 流程：第一次阅读全文并生成全局规划，第二次把规划转换为严格校验的 storyboard，最后调用本地渲染器。

安装依赖：

```powershell
npm install
```

只在当前 PowerShell 窗口设置密钥：

```powershell
$env:OPENAI_API_KEY="你的 API Key"
```

不要把真实密钥写进 `.env.example`、源代码或提交记录。

完整运行：

```powershell
npm run llm -- .\article.md .\output\article
```

只测试全文规划，不产生第二次调用和 GIF：

```powershell
npm run llm -- .\article.md .\output\article --plan-only
```

生成 plan 和 storyboard，但暂不渲染：

```powershell
npm run llm -- .\article.md .\output\article --no-render
```

默认模型为 `gpt-5.6-luna`，可临时切换：

```powershell
$env:OPENAI_MODEL="gpt-5.6-terra"
```

### 使用 DeepSeek API

程序也支持 DeepSeek 的 OpenAI-compatible Chat Completions 和 JSON Output。只在当前 PowerShell 窗口设置：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
$env:LLM_PROVIDER="deepseek"
$env:LLM_MODEL="deepseek-v4-flash"
```

然后使用相同命令：

```powershell
npm.cmd run llm -- .\examples\long_article.md .\output\deepseek-test --plan-only
```

程序会对 DeepSeek 返回的 JSON 进行本地 Zod 校验；若返回空内容、非法 JSON 或不符合 storyboard Schema，会自动重试，最多三次。不要同时依赖两个供应商的 Key；如果两个环境变量都存在，请显式设置 `LLM_PROVIDER`。
