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

- **三工具闭环**：读文件 (`read_file`)、写文件 (`write_file`)、执行命令 (`bash`)
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
src/
├── cli.ts                    # 入口：参数解析 + 环境验证
├── main.tsx                  # Ink 渲染入口
├── prompts.ts                # 系统提示词
├── storage.ts                # 会话持久化（JSON 文件）
├── types.ts                  # 核心类型定义
├── components/
│   ├── App.tsx               # 顶层容器
│   ├── REPL.tsx              # 主交互循环
│   ├── MessageList.tsx       # 消息渲染
│   └── PromptInput.tsx       # 输入组件
├── core/
│   ├── queryLoop.ts          # 核心 Agent 循环（AsyncGenerator）
│   ├── openaiAdapter.ts      # OpenAI API 流式适配
│   ├── messagePipeline.ts    # 消息组装 + 截断
│   └── toolRunner.ts         # 工具调度（读写分离并发）
└── tools/
    ├── types.ts              # Tool 接口定义
    ├── readTool.ts           # 文件读取
    ├── writeTool.ts          # 文件写入
    └── bashTool.ts           # Shell 命令执行
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
| `tools` | 3 个工具的 JSON Schema 定义（固定不变） |

### 与 Claude Code 原版对比

| 维度 | Claude Code | Mini Agent |
|---|---|---|
| 源文件数 | ~1919 | 16 |
| 依赖数 | 50+ | 6 |
| 消息类型 | 20+ 种内部类型 + API 格式转换 | 4 种，直接用 OpenAI 格式 |
| 工具数 | 30+ (动态加载) | 3 (静态注册) |
| 上下文管理 | 四级压缩 (snip/micro/collapse/autocompact) | 消息数量滑动窗口 |
| API 支持 | Anthropic / AWS Bedrock / Google Vertex | 任意 OpenAI 兼容 |
| 权限系统 | 精细的工具权限审批 | 无限制 |
| 扩展机制 | MCP / Plugin / Skill / Agent Swarm | 无 |
| 会话恢复 | 支持 (`--resume`) | 支持 (`--resume`) |

## 如何扩展

Mini Agent 设计为易于扩展的起点：

**添加新工具**：在 `src/tools/` 创建文件，实现 `Tool` 接口，在 `main.tsx` 注册即可。

```typescript
// src/tools/myTool.ts
import type { Tool } from './types.js'

export const myTool: Tool = {
  name: 'my_tool',
  description: '...',
  parameters: { /* JSON Schema */ },
  async call(args) { return 'result' },
  isReadOnly() { return true },
}
```

**其他扩展方向**：
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
