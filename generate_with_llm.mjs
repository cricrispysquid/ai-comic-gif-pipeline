import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

const Icon = z.enum(['chat', 'brain', 'schema', 'graph']);
const Plan = z.object({
  title: z.string().min(1),
  language: z.string().min(1),
  thesis: z.string().min(1),
  audience: z.string().min(1),
  glossary: z.array(z.object({ term: z.string(), definition: z.string() })).max(20),
  visual_style: z.object({
    palette: z.string(),
    character: z.string(),
    recurring_metaphor: z.string()
  }),
  sections: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    heading: z.string().min(1),
    purpose: z.string().min(1),
    key_points: z.array(z.string().min(1)).min(1).max(9)
  })).min(1).max(12)
});

const Storyboard = z.object({
  version: z.literal(1),
  style: z.literal('pastel-handdrawn'),
  title: z.string().min(1),
  pages: z.array(z.object({
    title: z.string().min(1),
    section: z.string().min(1),
    pageLabel: z.string().min(1),
    cards: z.array(z.object({
      title: z.string().min(1).max(60),
      body: z.string().min(1).max(320),
      icon: Icon
    })).min(1).max(3)
  })).min(1).max(36)
});

function usage() {
  console.log('Usage: node generate_with_llm.mjs <article.md|txt> [output-dir]');
  console.log('Environment: DEEPSEEK_API_KEY or OPENAI_API_KEY (one required)');
  console.log('Optional: LLM_PROVIDER, LLM_MODEL, DEEPSEEK_BASE_URL');
}

function parseArgs(argv) {
  const positional = argv.filter(v => !v.startsWith('--'));
  return {
    input: positional[0],
    output: positional[1] || 'output/llm-result',
    planOnly: argv.includes('--plan-only'),
    noRender: argv.includes('--no-render')
  };
}

async function openAIParsedResponse(client, { model, schema, name, instructions, input }) {
  const response = await client.responses.parse({
    model,
    instructions,
    input,
    text: { format: zodTextFormat(schema, name) }
  });
  if (!response.output_parsed) {
    throw new Error(`The model returned no parsed ${name}. Check refusal/output details in the API dashboard.`);
  }
  return response.output_parsed;
}

async function deepSeekParsedResponse(client, { model, schema, name, instructions, input }) {
  const jsonSchema = z.toJSONSchema(schema);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `${instructions}\n\nReturn JSON only. The JSON must match this schema:\n${JSON.stringify(jsonSchema)}`
          },
          { role: 'user', content: input }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 16384,
        stream: false
      });
      const content = completion.choices?.[0]?.message?.content;
      if (!content?.trim()) throw new Error('DeepSeek returned empty JSON content.');
      return schema.parse(JSON.parse(content));
    } catch (error) {
      lastError = error;
      if (attempt < 3) console.warn(`${name} validation failed (attempt ${attempt}/3); retrying...`);
    }
  }
  throw new Error(`DeepSeek could not produce a valid ${name} after 3 attempts: ${lastError?.message}`);
}

function chooseProvider() {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit && !['deepseek', 'openai'].includes(explicit)) throw new Error('LLM_PROVIDER must be deepseek or openai.');
  const provider = explicit || (process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'openai');
  const apiKey = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider, apiKey: null };
  if (provider === 'deepseek') {
    return {
      provider, apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.LLM_MODEL || 'deepseek-v4-flash'
    };
  }
  return { provider, apiKey, model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna' };
}

async function render(storyboardPath, outputDir) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['comic_pipeline.js', storyboardPath, outputDir], {
      cwd: process.cwd(), stdio: 'inherit', shell: false
    });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Renderer exited with code ${code}`)));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) { usage(); process.exitCode = 1; return; }
  const config = chooseProvider();
  if (!config.apiKey) {
    console.error(`Missing ${config.provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'OPENAI_API_KEY'}. Set it in your shell; do not paste it into source files.`);
    console.error('DeepSeek: $env:DEEPSEEK_API_KEY="..."');
    console.error('OpenAI:   $env:OPENAI_API_KEY="..."');
    process.exitCode = 2; return;
  }

  const inputPath = path.resolve(args.input);
  const outputDir = path.resolve(args.output);
  const article = await fs.readFile(inputPath, 'utf8');
  if (article.trim().length < 80) throw new Error('The article is too short to plan.');
  await fs.mkdir(outputDir, { recursive: true });

  const { provider, model } = config;
  const client = new OpenAI({ apiKey: config.apiKey, ...(config.baseURL ? { baseURL: config.baseURL } : {}) });
  const parsedResponse = provider === 'deepseek' ? deepSeekParsedResponse : openAIParsedResponse;
  console.log(`[1/3] Planning the full article with ${provider}/${model}...`);
  const plan = await parsedResponse(client, {
    model, schema: Plan, name: 'article_plan',
    instructions: [
      'You are the content planner for a pastel hand-drawn educational infographic series.',
      'Read the entire article before planning. Preserve technical correctness and causal order.',
      'Create a global outline, glossary, and consistent visual direction before any page is composed.',
      'Do not mechanically map paragraphs to pages. Merge repetition and split dense concepts semantically.',
      'Keep each key point concise enough to become one visual card later.'
    ].join('\n'),
    input: `SOURCE ARTICLE\n\n${article}`
  });
  const planPath = path.join(outputDir, 'plan.json');
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
  console.log(`Saved ${planPath}`);
  if (args.planOnly) return;

  console.log(`[2/3] Composing storyboard pages with ${provider}/${model}...`);
  const storyboard = await parsedResponse(client, {
    model, schema: Storyboard, name: 'comic_storyboard',
    instructions: [
      'You compose a sequence of square, pastel hand-drawn technical infographic pages.',
      'Use the supplied global plan as the single source of truth.',
      'Create one or more pages per section and keep the section order.',
      'Each page must have 1 to 3 cards. Prefer 2 or 3; use 1 only for a strong conclusion.',
      'Card titles must be short. Card bodies must be self-contained and readable, not fragments.',
      'Avoid repeating the article title or the same background context on every page.',
      'Use one of the permitted semantic icons: chat, brain, schema, graph.',
      'Use pageLabel as a local section page number such as 1, 2, or 3.'
    ].join('\n'),
    input: `GLOBAL PLAN\n\n${JSON.stringify(plan, null, 2)}`
  });
  const storyboardPath = path.join(outputDir, 'storyboard.json');
  await fs.writeFile(storyboardPath, JSON.stringify(storyboard, null, 2));
  console.log(`Saved ${storyboardPath}`);
  if (args.noRender) return;

  console.log('[3/3] Rendering GIFs locally...');
  await render(storyboardPath, outputDir);
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
