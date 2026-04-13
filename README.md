# Mini Agent

一个最小化的终端 AI 编程助手，从 [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) 架构中提炼核心设计，用 **16 个源文件、6 个依赖** 实现完整的 "思考 → 行动 → 观察" Agent 闭环。

## 为什么做这个

现有的 AI Agent（Claude Code、Cursor、Cline 等）动辄几千个文件、几百个依赖，想理解 "Agent 到底是怎么运行的" 很难从源码入手。

Mini Agent 把核心提炼出来：**一个 while 循环 + 三个工具 + 流式 API 调用**，让你能在 30 分钟内读完全部代码，理解一个编程 Agent 的完整运行机制。

## 核心架构

```
用户输入
  │
  ▼
┌─────────────────────┐
│  queryLoop (while)   │  ← 核心循环
│  ┌─────────────────┐ │
│  │ 1. 组装 messages │ │
│  │ 2. 调用模型 API  │ │──→ OpenAI 兼容 API（流式）
│  │ 3. 解析响应      │ │
│  │ 4. 有 tool_calls?│ │
│  │    ├─ 是 → 执行  │ │──→ read_file / write_file / bash
│  │    └─ 否 → 结束  │ │
│  └─────────────────┘ │
└─────────────────────┘
  │
  ▼
TUI 渲染（Ink + React）
```

## 功能

- **工具闭环**：内置读文件 (`read_file`)、写文件 (`write_file`)、执行命令 (`bash`)
- **工具扩展**：在 `tools/` 目录放入 `.ts` 文件即可自动加载自定义工具，零配置
- **流式输出**：模型响应边生成边显示
- **自主多轮**：模型可连续调用工具（最多 50 轮），自主完成复杂任务
- **对话持久化**：自动保存会话到磁盘，支持 `--resume` 恢复
- **任意模型**：兼容所有 OpenAI API 格式的模型服务（OpenAI / DeepSeek / 硅基流动 / Ollama 等）
- **终端 TUI**：基于 Ink + React 的交互界面

## 快速开始

### 安装

```bash
git clone https://github.com/lzyscg/mini-agent.git
cd mini-agent
npm install
```

### 配置

复制 `.env` 并填入你的 API Key：

```bash
cp .env .env.local
```

```env
# 必填：API Key
OPENAI_API_KEY=sk-your-key-here

# 可选：自定义 API 地址（支持任意 OpenAI 兼容服务）
OPENAI_BASE_URL=https://api.openai.com/v1

# 可选：模型名称（默认 gpt-4o）
MODEL_NAME=gpt-4o
```

**各服务商配置示例**：

| 服务商 | OPENAI_BASE_URL | MODEL_NAME |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen3-8B` |
| Ollama (本地) | `http://localhost:11434/v1` | `qwen2.5:14b` |

### 运行

```bash
# 新会话
npm start

# 恢复上次对话
npm start -- --resume

# 恢复指定会话（支持 ID 前缀匹配）
npm start -- --resume a3f2b1c0

# 强制新会话
npm start -- --new

# 查看所有保存的会话
npm start -- --list
```

## 项目结构

```
├── tools/                       # ← 自定义工具放这里（自动加载）
│   ├── _template.ts             #   工具开发模板（_开头的文件会被忽略）
│   └── fetchTool.ts             #   示例：HTTP 请求工具
├── skills/                      # ← Skill 放这里（自动加载 + 关键词匹配）
│   ├── _template.md             #   Skill 开发模板
│   ├── git-workflow.md          #   示例：Git 操作规范
│   ├── code-review.md           #   示例：代码审查流程
│   └── project-init.md          #   示例：项目初始化指引
├── src/
│   ├── cli.ts                   # 入口：参数解析 + 环境验证
│   ├── main.tsx                 # Ink 渲染入口
│   ├── prompts.ts               # 系统提示词（动态列出工具 + skills）
│   ├── storage.ts               # 会话持久化（JSON 文件）
│   ├── types.ts                 # 核心类型定义
│   ├── components/
│   │   ├── App.tsx              # 顶层容器
│   │   ├── REPL.tsx             # 主交互循环
│   │   ├── MessageList.tsx      # 消息渲染
│   │   └── PromptInput.tsx      # 输入组件
│   ├── core/
│   │   ├── queryLoop.ts         # 核心 Agent 循环（AsyncGenerator）
│   │   ├── openaiAdapter.ts     # OpenAI API 流式适配
│   │   ├── messagePipeline.ts   # 消息组装 + 截断
│   │   ├── toolRunner.ts        # 工具调度（读写分离并发）
│   │   ├── toolLoader.ts        # 工具动态加载器
│   │   ├── skillLoader.ts       # Skill 加载器（扫描 + 解析 frontmatter）
│   │   └── skillMatcher.ts      # Skill 匹配器（关键词 → 注入上下文）
│   └── tools/
│       ├── types.ts             # Tool 接口定义
│       ├── readTool.ts          # 内置：文件读取
│       ├── writeTool.ts         # 内置：文件写入
│       └── bashTool.ts          # 内置：Shell 命令执行
```

## 设计解读

### 消息流转

```
REPL (React state)          queryLoop                    OpenAI API
     │                          │                            │
     │── history + userMsg ───→ │                            │
     │                          │── buildMessages() ───→     │
     │                          │   [system, ...history,     │
     │                          │    userMsg]                 │
     │                          │                            │
     │                          │── callModelStreaming() ──→ │
     │  ◄── text_delta ────── │ ◄── stream chunks ──────── │
     │                          │                            │
     │                          │   模型返回 tool_calls?      │
     │                          │   ├─ 是 → runTools()       │
     │                          │   │   追加 tool results     │
     │                          │   │   回到 while 顶部 ──→  │ (再次调用)
     │                          │   └─ 否 → turn_complete    │
     │  ◄── turn_complete ──── │                            │
     │   (更新 state + 保存)    │                            │
```

### 每次 API 调用发送的内容

| 字段 | 内容 |
|---|---|
| `model` | `.env` 中配置的模型名 |
| `stream` | `true`（流式） |
| `messages` | `[system, ...对话历史]`，随工具循环不断增长 |
| `tools` | 所有已加载工具的 JSON Schema 定义（内置 + 自定义） |

### 与 Claude Code 原版对比

| 维度 | Claude Code | Mini Agent |
|---|---|---|
| 源文件数 | ~1919 | 16 |
| 依赖数 | 50+ | 6 |
| 消息类型 | 20+ 种内部类型 + API 格式转换 | 4 种，直接用 OpenAI 格式 |
| 工具数 | 30+ (动态加载) | 3 内置 + 自定义扩展 (动态加载) |
| 上下文管理 | 四级压缩 (snip/micro/collapse/autocompact) | 消息数量滑动窗口 |
| API 支持 | Anthropic / AWS Bedrock / Google Vertex | 任意 OpenAI 兼容 |
| 权限系统 | 精细的工具权限审批 | 无限制 |
| 扩展机制 | MCP / Plugin / Skill / Agent Swarm | 无 |
| 会话恢复 | 支持 (`--resume`) | 支持 (`--resume`) |

## 自定义工具

Mini Agent 支持动态加载自定义工具。只需在指定目录放入 `.ts` / `.js` 文件，启动时自动发现和加载，无需修改任何源码。

### 快速添加

1. 复制模板：
```bash
cp tools/_template.ts tools/myTool.ts
```

2. 编辑 `tools/myTool.ts`，实现你的工具逻辑

3. 重启 agent — 启动时会显示 `[tool-loader] Loaded 1 custom tool(s): my_tool`

### 工具目录

| 目录 | 用途 | 是否 git 跟踪 |
|---|---|---|
| `tools/` | 项目级自定义工具 | 是（可分享） |
| `.mini-agent/tools/` | 用户级自定义工具 | 否（已 gitignore） |

两个目录都会被扫描。以 `_` 开头的文件会被忽略（可用于模板和草稿）。

### Tool 接口

```typescript
interface Tool {
  name: string                                      // 工具名（模型调用时使用）
  description: string                               // 工具描述（模型读这个决定何时用）
  parameters: Record<string, unknown>               // JSON Schema 定义入参
  call(args: Record<string, unknown>): Promise<string>  // 执行逻辑，返回字符串结果
  isReadOnly(args: Record<string, unknown>): boolean    // 是否只读（只读工具可并发）
}
```

### 导出方式

以下三种导出方式都支持：

```typescript
// 方式 1：命名导出（推荐）
export const tool: Tool = { ... }

// 方式 2：默认导出
export default { ... } satisfies Tool

// 方式 3：任意命名导出（取第一个）
export const myCustomTool: Tool = { ... }
```

### 示例：HTTP 请求工具

项目自带了一个 `tools/fetchTool.ts` 示例，让 agent 能访问 URL：

```typescript
export const tool: Tool = {
  name: 'fetch_url',
  description: 'Fetch the content of a URL and return it as text.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
      method: { type: 'string', description: 'HTTP method. Defaults to GET.' },
    },
    required: ['url'],
  },
  async call(args) {
    const response = await fetch(args.url as string)
    return await response.text()
  },
  isReadOnly() { return true },
}
```

### 覆盖内置工具

自定义工具可以通过同名覆盖内置工具。比如创建一个 `tools/bashTool.ts`，导出 `name: 'bash'` 的工具，就会替换内置的 bash 工具。

## Skills 技能系统

Skills 是给模型的"操作指南"。当用户输入匹配到某个 skill 的触发关键词时，skill 的完整内容会被自动注入到对话上下文中，引导模型按照最佳实践执行任务。

### 与工具的区别

| | Tool（工具） | Skill（技能） |
|---|---|---|
| 本质 | 可执行的函数 | 提示词/指南文档 |
| 格式 | `.ts` / `.js` 文件 | `.md` Markdown 文件 |
| 作用 | 给模型新的"动作能力" | 给模型"如何做好某事"的知识 |
| 注入方式 | 作为 `tools` 参数发给 API | 作为上下文消息注入 messages |
| 示例 | `read_file`, `bash` | "Git 提交规范", "代码审查流程" |

### 快速添加

1. 在 `skills/` 目录创建 `.md` 文件：

```markdown
---
name: My Skill
description: Brief description
triggers: keyword1, keyword2, keyword3
---

# Skill Content

When the user asks about this topic, follow these guidelines:
- Step 1...
- Step 2...
```

2. 重启 agent — 自动加载

### Skill 目录

| 目录 | 用途 |
|---|---|
| `skills/` | 项目级（可 git 跟踪，团队共享） |
| `.mini-agent/skills/` | 用户级（已 gitignore） |

### 工作原理

```
用户输入 "帮我 commit 这个改动"
       │
       ▼
skillMatcher 扫描所有 skill 的 triggers
       │
       ├── git-workflow.md triggers: [git, commit, branch, ...]
       │   "commit" 命中 → score: 2
       │
       ▼
命中的 skill 内容注入到 messages 中：
[system, skillContext, assistantAck, ...history, userMsg]
       │
       ▼
模型看到 skill 指南 → 按照规范执行 git 操作
```

### 内置示例 Skills

| Skill | 触发词 | 作用 |
|---|---|---|
| Git Workflow | git, commit, branch, merge... | Git 操作规范和安全实践 |
| Code Review | review, refactor, improve... | 代码审查的系统化流程 |
| Project Init | init, create, scaffold, setup... | 项目初始化最佳实践 |

### 更多扩展方向

- Token 级别的上下文压缩
- 工具权限审批机制
- MCP 协议支持
- 多 Agent 协同
- 图片/PDF 多模态输入

## 依赖

| 包 | 用途 |
|---|---|
| `ink` + `react` | 终端 TUI 渲染 |
| `openai` | API 客户端 |
| `dotenv` | 环境变量加载 |
| `zod` | 参数校验 |
| `tsx` | 直接运行 TypeScript (dev) |

## License

MIT
