# Mini Agent

一个最小化的终端 AI 编程助手，从 [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) 架构中提炼核心设计，用 **~28 个源文件、7 个依赖** 实现完整的 "思考 → 行动 → 观察" Agent 闭环，支持多 Agent 子代理、MCP 协议、Plugin 插件系统、Hooks 事件机制和五级渐进式上下文压缩。

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
- **MCP 协议**：通过 `mcp.json` 配置即可接入任意 MCP Server（GitHub、数据库、浏览器等）
- **Plugin 系统**：一个插件 = 一个目录，打包 tools + skills + MCP + hooks，支持安装/卸载/启禁用
- **Hooks 事件**：在工具调用前/后插入自定义逻辑（审批、日志、修改等）
- **Skills 技能**：Markdown 格式的操作指南，模型按需激活，延迟加载
- **多 Agent 子代理**：模型可调用 `agent` 工具派出独立子代理处理子任务，支持指定模型和工具白名单
- **上下文压缩**：五级渐进式压缩管线（预算截断 → 头部裁剪 → 微压缩 → 折叠摘要 → 全量摘要），自动管理长对话上下文
- **流式输出**：模型响应边生成边显示
- **自主多轮**：模型可连续调用工具（默认最多 50 轮），自主完成复杂任务
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

# 可选：单次提问内工具循环最大轮次（默认 50）
MAX_TURNS=50

# 可选：子代理最大轮次（默认 30）
SUBAGENT_MAX_TURNS=30

# 可选：上下文窗口大小（默认 128000）
CONTEXT_WINDOW_TOKENS=128000

# 可选：压缩摘要模型（默认跟随 MODEL_NAME）
COMPACT_MODEL=gpt-4o-mini
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
├── mcp.json                     # ← MCP 服务器配置（已 gitignore，含密钥）
├── mcp.json.example             #   MCP 配置示例
├── tools/                       # ← 自定义工具放这里（自动加载）
│   ├── _template.ts             #   工具开发模板（_开头的文件会被忽略）
│   └── fetchTool.ts             #   示例：HTTP 请求工具
├── skills/                      # ← Skill 放这里（自动注册为 use_skill 工具）
│   ├── _template.md             #   Skill 开发模板
│   ├── git-workflow.md          #   示例：Git 操作规范
│   ├── code-review.md           #   示例：代码审查流程
│   └── project-init.md          #   示例：项目初始化指引
├── plugins/                     # ← 插件放这里（_开头的被忽略）
│   └── _example/                #   示例插件
│       ├── plugin.json          #     插件清单
│       ├── tools/helloTool.ts   #     插件提供的工具
│       ├── skills/greeting.md   #     插件提供的 skill
│       └── hooks/logToolCall.ts #     插件提供的 hook
├── src/
│   ├── cli.ts                   # 入口：参数解析 + plugin 子命令
│   ├── main.tsx                 # Ink 渲染入口（加载全部扩展）
│   ├── prompts.ts               # 系统提示词（动态列出已加载工具）
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
│   │   ├── messagePipeline.ts   # 消息组装
│   │   ├── tokens.ts            # Token 粗估 + 上下文窗口配置
│   │   ├── toolRunner.ts        # 工具调度（读写分离 + hooks 集成）
│   │   ├── toolLoader.ts        # 工具动态加载器
│   │   ├── mcpClient.ts         # MCP 客户端（连接 + 工具翻译）
│   │   ├── skillLoader.ts       # Skill 元数据加载 + 延迟内容读取
│   │   ├── pluginLoader.ts      # 插件发现 + 清单解析 + 组件加载
│   │   ├── pluginManager.ts     # 插件安装/卸载/启禁用 CLI 操作
│   │   ├── hooks.ts             # Hook 类型定义 + 事件总线
│   │   └── compress/            # 五级上下文压缩管线
│   │       ├── index.ts         #   管线编排入口
│   │       ├── toolResultBudget.ts  # L1: 超大工具结果截断
│   │       ├── snip.ts          #   L2: 头部裁剪旧消息轮次
│   │       ├── microCompact.ts  #   L3: 清空旧 tool_result
│   │       ├── contextCollapse.ts   # L4: 折叠旧段为摘要
│   │       └── autoCompact.ts   #   L5: 全量摘要（最后防线）
│   └── tools/
│       ├── types.ts             # Tool 接口定义
│       ├── readTool.ts          # 内置：文件读取
│       ├── writeTool.ts         # 内置：文件写入
│       ├── bashTool.ts          # 内置：Shell 命令执行
│       ├── skillTool.ts         # use_skill 工具（模型主动调用 skill）
│       └── agentTool.ts        # agent 工具（派出独立子代理）
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
| 上下文管理 | 四级压缩 (snip/micro/collapse/autocompact) | 五级渐进式压缩管线 |
| API 支持 | Anthropic / AWS Bedrock / Google Vertex | 任意 OpenAI 兼容 |
| 权限系统 | 精细的工具权限审批 | 无限制 |
| 扩展机制 | MCP / Plugin / Skill / Agent Swarm | MCP + Plugin + Skill + Hooks + Sub-Agent |
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

Skills 是注册为 `use_skill` 工具的"操作指南"。模型自主决定何时激活哪个 skill，skill 内容在调用时才从磁盘加载（延迟加载），以 tool result 的形式注入对话上下文。

### 设计理念

与旧版关键词匹配不同，现在的 skills 系统让 **模型自己判断** 是否需要 skill：

1. **注册为工具**：所有 skill 的元数据（名称、描述）在启动时加载，注册为一个 `use_skill` 工具
2. **模型主动调用**：模型根据用户意图，自主决定是否调用 `use_skill({ name: "..." })`
3. **延迟加载**：skill 的完整 Markdown 内容只在被调用时才从磁盘读取
4. **Inline 注入**：内容作为 tool result 返回，自然融入对话上下文

```
用户输入 "帮我 commit 这个改动"
       │
       ▼
模型看到 use_skill 工具描述中列出了 "Git Workflow" skill
       │
       ▼
模型决定调用 use_skill({ name: "Git Workflow" })
       │
       ▼
skillTool.call() → 从磁盘读取 git-workflow.md 内容
       │
       ▼
skill 内容作为 tool result 返回到 messages 中
       │
       ▼
模型继续执行，遵循 skill 中的 Git 操作规范
```

### 与自定义工具的区别

| | Tool（工具） | Skill（技能） |
|---|---|---|
| 本质 | 可执行的函数 | 提示词/指南文档 |
| 格式 | `.ts` / `.js` 文件 | `.md` Markdown 文件 |
| 作用 | 给模型新的"动作能力" | 给模型"如何做好某事"的知识 |
| 注入方式 | 执行后返回结果 | 作为 `use_skill` 的 tool result 注入 |
| 加载时机 | 启动时全量加载 | 启动时只加载元数据，内容延迟加载 |
| 触发方式 | 模型直接调用 | 模型通过 `use_skill` 工具调用 |

### 快速添加

1. 在 `skills/` 目录创建 `.md` 文件：

```markdown
---
name: My Skill
description: Brief description of what this skill provides
triggers: keyword1, keyword2, keyword3
---

# Skill Content

When the user asks about this topic, follow these guidelines:
- Step 1...
- Step 2...
```

2. 重启 agent — 启动时显示 `[skill-loader] Found N skill(s): ...`

### Skill 目录

| 目录 | 用途 |
|---|---|
| `skills/` | 项目级（可 git 跟踪，团队共享） |
| `.mini-agent/skills/` | 用户级（已 gitignore） |

### 内置示例 Skills

| Skill | 描述 | 作用 |
|---|---|---|
| Git Workflow | Git 操作规范 | 提交、分支、合并的安全实践 |
| Code Review | 代码审查流程 | 系统化的代码审查方法论 |
| Project Init | 项目初始化指引 | 新项目脚手架的最佳实践 |

## MCP 协议支持

Mini Agent 支持 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)，让你通过配置文件接入任意 MCP Server 提供的工具，无需编写代码。

### 工作原理

```
启动 → 读取 mcp.json → 连接各 MCP Server (stdio)
                │
                ▼
         MCP tools/list → 获取服务器提供的工具列表
                │
                ▼
         翻译为 Tool 接口 → name: mcp__<server>__<tool>
                │
                ▼
         合并到 tools 数组 → 对 queryLoop 完全透明
```

MCP 工具和内置工具、自定义工具走完全相同的 pipeline。模型看到的就是一组统一的 tools，不区分来源。

### 快速配置

1. 复制配置模板：

```bash
cp mcp.json.example mcp.json
```

2. 编辑 `mcp.json`，配置你需要的 MCP Server：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

3. 重启 agent — 启动时显示连接状态和工具列表

### 配置格式

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "可执行命令",
      "args": ["参数列表"],
      "env": { "环境变量": "值" },
      "cwd": "工作目录（可选）",
      "disabled": false
    }
  }
}
```

### 配置目录

| 路径 | 用途 |
|---|---|
| `mcp.json` | 项目级（已 gitignore，含密钥） |
| `.mini-agent/mcp.json` | 用户级（同样不跟踪） |

两个配置会被合并，后者优先覆盖同名 server。

### 常用 MCP Server 示例

| Server | 安装命令 | 提供的能力 |
|---|---|---|
| GitHub | `npx -y @modelcontextprotocol/server-github` | 仓库管理、Issue、PR |
| Filesystem | `npx -y @modelcontextprotocol/server-filesystem /path` | 安全的文件系统访问 |
| SQLite | `npx -y @modelcontextprotocol/server-sqlite db.sqlite` | 数据库查询 |
| Puppeteer | `npx -y @modelcontextprotocol/server-puppeteer` | 浏览器自动化 |
| PostgreSQL | `npx -y @modelcontextprotocol/server-postgres` | PostgreSQL 查询 |

更多 MCP Server 可在 [MCP Servers 仓库](https://github.com/modelcontextprotocol/servers) 查找。

### 工具命名

MCP 工具会自动加上命名空间前缀：`mcp__<server名>__<工具名>`。例如 GitHub server 的 `create_issue` 工具在 agent 中名为 `mcp__github__create_issue`。

## Plugin 插件系统

Plugin 是 tools + skills + MCP + hooks 的打包单元。一个插件 = 一个目录 + `plugin.json` 清单。

### 快速上手

```bash
# 安装插件（从本地路径）
npm start -- plugin add ./path/to/my-plugin

# 安装插件（从 git 仓库）
npm start -- plugin add https://github.com/user/my-plugin.git

# 查看已安装插件
npm start -- plugin list

# 启用/禁用
npm start -- plugin enable my-plugin
npm start -- plugin disable my-plugin

# 卸载
npm start -- plugin remove my-plugin
```

### plugin.json 格式

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "your-name",
  "tools": "tools/",
  "skills": "skills/",
  "mcpServers": "mcp.json",
  "hooks": {
    "session_start": "hooks/onStart.ts",
    "before_tool_call": "hooks/beforeTool.ts",
    "after_tool_call": "hooks/afterTool.ts"
  }
}
```

所有字段除 `name` 外均可选。路径相对于插件目录。

### 插件目录

| 路径 | 用途 | git 跟踪 |
|---|---|---|
| `plugins/` | 项目级插件 | 是 |
| `.mini-agent/plugins/` | 用户级/已安装插件 | 否 |

以 `_` 开头的插件目录会被忽略（如 `_example`）。

### 插件能提供什么

| 组件 | 插件中的位置 | 合并到 |
|---|---|---|
| Tools | `tools/*.ts` | 全局 tools 数组 |
| Skills | `skills/*.md` | use_skill 工具 |
| MCP Servers | `mcp.json` | MCP 连接池 |
| Hooks | `hooks/*.ts` | 事件总线 |

### 创建插件

参考 `plugins/_example/` 示例：

```
my-plugin/
  plugin.json
  tools/
    myTool.ts
  skills/
    mySkill.md
  hooks/
    logToolCall.ts
```

## Hooks 事件系统

Hooks 允许在特定事件点插入自定义逻辑，主要通过 Plugin 注册。

### 事件类型

| 事件 | 触发时机 | 可以做什么 |
|---|---|---|
| `session_start` | 会话开始 | 注入初始上下文 |
| `before_tool_call` | 工具执行前 | 修改参数、阻止执行 |
| `after_tool_call` | 工具执行后 | 记录日志、统计耗时 |

### Hook 文件格式

```typescript
import type { HookContext } from '../../../src/core/hooks.js'

export default async function(ctx: HookContext): Promise<void> {
  if (ctx.event === 'before_tool_call') {
    // ctx.data.toolName, ctx.data.args
    // 设置 ctx.data.aborted = true 可阻止工具执行
  }

  if (ctx.event === 'after_tool_call') {
    // ctx.data.toolName, ctx.data.result, ctx.data.durationMs
    console.log(`Tool ${ctx.data.toolName} took ${ctx.data.durationMs}ms`)
  }
}
```

## 上下文压缩管线

长对话会超出模型的上下文窗口。Mini Agent 实现了五级渐进式压缩管线，在每次调用模型前自动按需压缩，避免丢失关键信息。

### 压缩流程

```
messages 原始数组
    │
    ▼
1. Tool Result Budget ── 截断超大 tool_result（>30k 字符）
    │
    ▼
2. Snip ── 从头部删除最老的对话轮次（70% 阈值触发）
    │
    ▼
3. Microcompact ── 清空旧 tool_result 内容，保留最近 5 个
    │
    ▼
4. Context Collapse ── 调模型对旧段生成摘要折叠（85% 阈值触发）
    │
    ▼
5. Autocompact ── 全量摘要替换历史（最后防线）
    │
    ▼
callModelStreaming()
```

### 各层级说明

| 层级 | 触发条件 | 动作 | 是否调模型 |
|---|---|---|---|
| L1 Tool Result Budget | 单条 tool_result > 30,000 字符 | 截断到前 2,000 字符 + 提示 | 否 |
| L2 Snip | 总 token > 窗口 × 70% | 按轮次从头部删除最老消息 | 否 |
| L3 Microcompact | 始终执行 | 保留最近 5 个 tool_result，清空更早的 | 否 |
| L4 Context Collapse | 总 token > 窗口 × 85% | 将旧 60% 消息折叠为模型生成的摘要 | 是 |
| L5 Autocompact | 总 token > 窗口 - 10,000 | 全量对话摘要替换所有历史 | 是 |

### 配置

```env
# 上下文窗口大小（默认 128000）
CONTEXT_WINDOW_TOKENS=128000

# 压缩/摘要使用的模型（默认跟随 MODEL_NAME，可指定更便宜的模型）
COMPACT_MODEL=gpt-4o-mini
```

## 多 Agent 子代理

模型可通过 `agent` 工具派出独立的子代理来处理子任务。子代理拥有自己的对话上下文，执行完毕后将结果返回给父会话。

### 工作原理

```
父会话 queryLoop
    │
    ├── 模型输出: tool_use: agent({ prompt: "...", model: "..." })
    │
    ▼
agentTool.call()
    │
    ├── 过滤工具集（去掉 agent 自身，防递归）
    ├── 构建子代理 system prompt
    ├── 启动独立 queryLoop（空 history）
    │     ├── 子代理调用工具...
    │     └── 子代理输出最终文本
    │
    ▼
结果作为 tool_result 回到父会话
```

### agent 工具参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `prompt` | `string` (必填) | 交给子代理的详细任务描述 |
| `description` | `string` (可选) | 3-5 词简短标题 |
| `model` | `string` (可选) | 子代理使用的模型（如 `gpt-4o-mini`），不传则与父相同 |
| `allowed_tools` | `string[]` (可选) | 工具白名单，不传则使用全部可用工具 |

### 使用场景

- **任务分解**：将复杂任务拆成多个子任务，分别由子代理执行
- **探索/研究**：派子代理阅读代码、搜索文件，父代理继续当前任务
- **成本优化**：让子代理使用更便宜的模型处理简单子任务

### 安全机制

- **防递归**：子代理的工具集中自动去掉 `agent` 工具，只允许一层嵌套
- **独立轮次上限**：子代理默认最多 30 轮（`SUBAGENT_MAX_TURNS`），独立于父
- **独立上下文**：子代理从空 history 开始，不共享父的对话历史

### 更多扩展方向

- 工具权限审批机制
- 异步子代理 + 通知机制
- 图片/PDF 多模态输入

## 依赖

| 包 | 用途 |
|---|---|
| `ink` + `react` | 终端 TUI 渲染 |
| `openai` | API 客户端 |
| `@modelcontextprotocol/sdk` | MCP 协议客户端 |
| `dotenv` | 环境变量加载 |
| `zod` | 参数校验 |
| `tsx` | 直接运行 TypeScript (dev) |

## License

MIT
