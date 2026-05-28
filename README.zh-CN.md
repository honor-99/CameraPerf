# CameraPerf

[English](README.md) | [中文](README.zh-CN.md)

[![License: AGPL-3.0-or-later](https://img.shields.io/github/license/honor-99/CameraPerf)](LICENSE)
[![Node.js 24 LTS](https://img.shields.io/badge/Node.js-24%20LTS-brightgreen)](backend/package.json)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6)](backend/tsconfig.json)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ed)](docker-compose.hub.yml)

> 基于 [Perfetto](https://perfetto.dev/) 的 AI 驱动 Android Camera 性能分析后端。

CameraPerf 是 [SmartPerfetto](https://github.com/Gracker/SmartPerfetto) 的 Camera 专项衍生版本，专注于 Android Camera 预览、录像和多路输出场景的性能分析。项目保留了 Skill 引擎、trace_processor_shell 通信层和 AI 分析运行时，移除了所有非 Camera 分析域。纯后端架构，通过 REST API 和 SSE 对外提供服务。

## 分析范围

| 问题域 | 分析能力 |
|--------|----------|
| **预览卡顿** | 丢帧、VSync 对齐、Buffer stuffing |
| **录像丢帧** | 编码器背压、发热降频、I/O 压力 |
| **多路输出背压** | 并发预览 + 录像 + 分析管线竞争 |
| **发热降频** | DVFS 限频、CPU 集群迁移、GPU 频率塌陷 |
| **Camera 管线延迟** | Release fence 延迟、Sensor 触发对齐、Binder IPC 开销 |

## 先配置 AI Provider

CameraPerf 使用 Claude Agent SDK。如果你是在 Claude Code 已经能正常工作的本机上运行，SDK 可以复用 Claude Code 的本地认证/配置，不需要在 `.env` 里写 API key。

其他情况按运行方式选择配置位置：

| 运行方式 | 推荐凭证位置 | 说明 |
|----------|--------------|------|
| 本地源码运行，且 Claude Code 已经能用 | 不需要 `.env` | 直接运行后端即可 |
| 本地源码运行，使用 API key 或代理 | `backend/.env` | 用 `cp backend/.env.example backend/.env` 创建 |
| Docker Hub 镜像 | 仓库根目录的 `.env` | 用 `cp backend/.env.example .env` 创建；容器看不到宿主机的 Claude Code 登录态 |
| 从源码构建 Docker 镜像 | `backend/.env` | `docker-compose.yml` 会读取这个文件 |

如果直连 Anthropic API，最小配置是：

```env
ANTHROPIC_API_KEY=***
```

如果接入 OpenAI、Gemini、DeepSeek 或其他第三方模型，推荐先通过 one-api/new-api/LiteLLM 暴露 Anthropic 兼容接口：

```env
ANTHROPIC_BASE_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-pro...oken
CLAUDE_MODEL=your-main-model
CLAUDE_LIGHT_MODEL=your-light-model
```

改完 env 文件后需要重启后端。Docker 运行用 `docker compose -f docker-compose.hub.yml restart`；本地运行重启后端即可。

## 快速开始

### Docker 运行（推荐）

只需要 Docker Desktop/Engine，并在 `.env` 里配置大模型凭证；不需要安装 Node.js，不需要 C++ 工具链。

```bash
git clone git@github.com:honor-99/CameraPerf.git
cd CameraPerf
cp backend/.env.example .env
# 编辑 .env，设置 ANTHROPIC_API_KEY，或为代理设置 ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d
```

- 后端健康检查：[http://localhost:3000/health](http://localhost:3000/health)

停止容器：

```bash
docker compose -f docker-compose.hub.yml down
```

上传文件和日志保存在 Docker volume 中，容器重启后仍会保留。

### 本地脚本运行

前置条件：**Node.js 24 LTS**。Windows 请使用 WSL2。

```bash
git clone git@github.com:honor-99/CameraPerf.git
cd CameraPerf

# 方式 A：如果这个终端里的 Claude Code 已经能用，不需要 .env。
# 方式 B：显式配置 API key 或 Anthropic 兼容代理。
cp backend/.env.example backend/.env
# 编辑 backend/.env，设置 ANTHROPIC_API_KEY

# 启动后端
cd backend && npm run dev
```

## API 接入

后端通过 REST 和 SSE 对外提供服务：

| 方法 | 路径 | 用途 |
|------|------|------|
| `POST` | `/api/agent/v1/analyze` | 启动分析 |
| `GET` | `/api/agent/v1/:sessionId/stream` | 订阅 SSE 进度流 |
| `GET` | `/api/agent/v1/:sessionId/status` | 查询分析状态 |
| `POST` | `/api/agent/v1/:sessionId/respond` | 继续多轮会话 |
| `POST` | `/api/agent/v1/resume` | 恢复已有 session |
| `GET` | `/api/agent/v1/:sessionId/report` | 获取分析报告 |
| `POST` | `/api/sql/query` | 直接执行 SQL 查询 |
| `POST` | `/api/trace/:traceId/analyze/*` | 分领域分析端点 |

如果后端不只在本机使用，建议设置 `CAMERAPERF_API_KEY`，受保护接口需带 `Authorization: Bearer ***`。

## 架构

```
Trace (.perfetto-trace)
        │
        ▼
trace_processor_shell  ──  SQL queries (HTTP RPC, 9100-9900)
        │
        ▼
Skill Engine (YAML DSL)
  ├── atomic/{frame,vsync,fence,...}.skill.yaml     (11 个)
  ├── composite/{cpu,gpu,thermal,...}.skill.yaml    (17 个)
  ├── modules/{hardware,kernel,framework}/          (10 个)
  ├── deep/                                         (2 个)
  └── pipelines/                                    (1 个)
        │
        ▼
Claude Agent SDK  ──  Analysis + report generation (SSE)
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 后端 | Node.js 24 LTS、TypeScript strict mode、Express |
| Agent 运行时 | Claude Agent SDK、MCP 工具、场景路由、Verifier、SSE 流式 |
| Trace 引擎 | Perfetto `trace_processor_shell`，通过 HTTP RPC 调用 |
| Skill 引擎 | `backend/skills/` 下 41 个 YAML Skill |
| 策略系统 | `backend/strategies/` 下 20 个 Markdown 策略和模板 |
| 测试 | Jest、Skill 校验、Strategy 校验、canonical trace 回归 |

## 目录结构

```
CameraPerf/
├── backend/
│   ├── src/agentv3/        # AI 运行时：场景路由、MCP 工具、Verifier
│   ├── src/services/       # Trace processor、Skill、Report、Session
│   ├── src/routes/         # REST API 路由
│   ├── src/controllers/    # 控制器
│   ├── skills/             # 41 个 YAML 分析 Skill
│   ├── strategies/         # 20 个场景策略和 Prompt 模板
│   ├── data/               # Perfetto SQL 索引缓存
│   └── tests/              # 单元测试和回归测试
├── docs/                   # 架构、API、Skill 系统文档
├── scripts/                # 开发和重启脚本
└── test-traces/            # 测试用 canonical trace 文件
```

## 保留资产（来自 SmartPerfetto）

- **41 个 Skill**：11 atomic（frame/vsync/fence）+ 17 composite（cpu/gpu/thermal/binder）+ 10 modules（hardware/kernel/framework）+ 2 deep + 1 pipeline
- **20 个策略**：场景策略 + 知识模板 + Prompt 模板
- **Skill 引擎**：完整的 YAML DSL 执行运行时
- **trace_processor_shell**：通信层 + SQL 知识库
- **Agent v3 运行时**：Claude Agent SDK 集成

## 已移除

- Agent v1/v2 架构
- Frontend UI（CameraPerf 是纯 API 后端）
- Rust flamegraph 分析器
- 非 Camera 领域知识：滑动、启动、ANR、Flutter、Compose、WebView、游戏引擎

## 进阶 Provider 配置

### 轮次预算

CameraPerf 区分 quick 和 full 两套轮次预算：

```bash
CLAUDE_QUICK_MAX_TURNS=10  # quick 模式默认值
CLAUDE_MAX_TURNS=60        # full 模式默认值
```

如果使用较慢模型，或某些 trace 需要更多工具调用轮次，可以调高这些值。修改 `.env` 后需要重启后端。

### 输出语言

面向用户的输出默认是简体中文。如果希望 AI 回答、流式进度和报告使用英文：

```bash
CAMERAPERF_OUTPUT_LANGUAGE=en
```

## 运行检查

```bash
# 类型检查
cd backend && npm run typecheck

# Skill 校验
cd backend && npm run validate:skills

# Strategy 校验
cd backend && npm run validate:strategies

# 核心测试
cd backend && npm run test:core

# 场景回归测试
cd backend && npm run test:scene-trace-regression

# 完整 PR 检查
npm run verify:pr
```

## 开发指南

必须满足的检查：

- 提 PR 前：在仓库根目录运行 `npm run verify:pr`
- Contract / 纯类型改动：`cd backend && npx tsc --noEmit` + 相关单测
- Skill YAML 改动：`npm run validate:skills` + 场景回归
- Strategy/template Markdown 改动：`npm run validate:strategies` + 场景回归

**不要在 TypeScript 里硬编码 Prompt 内容。** 场景逻辑应放在 `backend/strategies/*.strategy.md`，可复用内容放在 `*.template.md`。

## 文档

- [文档中心](docs/README.md)
- [架构总览](docs/architecture/overview.md)
- [API 参考](docs/reference/api.md)
- [Skill 系统指南](docs/reference/skill-system.md)
- [MCP 工具参考](docs/reference/mcp-tools.md)

## 贡献

欢迎贡献。比较适合开始的方向：

- 新增或改进 YAML Skill
- 改进场景策略和输出模板
- 为已知 trace 场景补充回归测试

提交 PR 前：

1. 阅读 CONTRIBUTING.md
2. Fork 仓库，并基于 `master` 创建分支
3. 保持改动范围清晰，并写明测试计划
4. 运行上方对应检查

## 联系

- Bug 和功能建议：[GitHub Issues](https://github.com/honor-99/CameraPerf/issues)
- 安全问题：[GitHub private advisory](https://github.com/honor-99/CameraPerf/security/advisories/new) 或 `qwerhyc@163.com`
- 合作、商业支持、赞助：[qwerhyc@163.com](mailto:qwerhyc@163.com)

## 许可证

CameraPerf 核心代码使用 [AGPL-3.0-or-later](LICENSE)。如需不受 AGPL 义务约束的商业授权，请通过 [qwerhyc@163.com](mailto:qwerhyc@163.com) 联系维护者。
