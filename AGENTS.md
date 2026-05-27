# CameraPerf Development Guide

Android Camera 性能分析平台，基于 Perfetto trace_processor。

## Language

用中英文思考，用中文回答。

## Compact Instructions

```
Tech: TypeScript strict, follow existing patterns
Dev:  tsx watch (backend) — auto-rebuild on save
Build: cd backend && npm run build
```

## Architecture Overview

```
Backend (Express @ :3000) ─── trace_processor_shell
         │
    ┌────┴────┐
    │ agentv3 │  Skill Engine (43 Camera Skills)
    └─────────┘  MCP tools (SQL/Skill/Perfetto)
```

**Core Concepts:**
- **Runtime: agentv3** — Codex Agent SDK 编排 (MCP tools)
- **Skill 引擎**: YAML DSL, 43 个 Camera 专用 Skill（Atomic/Composite/Config/Module/Fragment）
- **知识领域**: Camera 预览、录像、多路输出背压、发热降频、帧/Fence/VSync 分析
- SSE 实时流式输出

## Verification

| Task Type | Done When |
|-----------|-----------|
| Type/contract change | `cd backend && npx tsc --noEmit` |
| Skill YAML change | `npm run validate:skills` |
| Build/type error | `npm run typecheck` in backend/ |

## Environment

```bash
# backend/.env
PORT=3000
CAMERAPERF_API_KEY=xxx              # Optional, bearer token auth
# 更多配置见 backend/.env.example
```

## Key Rules

1. **NEVER hardcode prompt content in TypeScript** — use `*.strategy.md` / `*.template.md`
2. **ALWAYS run typecheck** after code changes

## Skill Routing

- Camera 性能分析 → invoke_skill (自动匹配 43 个 Camera Skill)
- SQL 查询 → execute_sql
- Trace 查询 → trace_processor_shell
