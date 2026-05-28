# 架构总览

CameraPerf 是一个纯 API 后端，专注 Android Camera 性能分析。基于 agentv3 + Skill 引擎，通过 Claude Agent SDK 编排 MCP 工具调用 trace_processor_shell 进行 SQL 分析。

```text
Backend: Express @ :3000
  ├─ /api/agent/v1/*          agentv3 分析主路径
  ├─ /api/traces/*            trace 上传和生命周期
  ├─ /api/skills/*            Skill 查询和执行
  ├─ /api/export/*            导出
  ├─ /api/reports/*           HTML report
  └─ trace_processor_shell    HTTP RPC pool, 9100-9900
```

## 核心模块

| 模块 | 位置 | 责任 |
|---|---|---|
| agentv3 runtime | `backend/src/agentv3/` | Claude Agent SDK 编排、MCP server、策略注入、verifier、记忆 |
| Skill engine | `backend/src/services/skillEngine/` | YAML Skill 加载、参数替换、SQL 执行、DataEnvelope 输出 |
| Skills | `backend/skills/` | 41 个 Camera 专用 Skill（Atomic/Composite/Deep/Pipeline/Module） |
| Strategies | `backend/strategies/` | Camera 场景策略、Prompt 模板、知识模板 |
| Trace processor | `backend/src/services/traceProcessorService.ts` | trace 加载、RPC 管理、SQL 查询 |
| Reports | `backend/src/services/htmlReportGenerator.ts` | HTML 报告生成 |

## 主分析数据流

```text
1. 用户上传 trace
   API -> /api/traces/upload -> TraceProcessorService -> trace_processor_shell

2. 用户发起分析
   API -> POST /api/agent/v1/analyze
      -> AgentAnalyzeSessionService.prepareSession()
      -> ClaudeRuntime.analyze()

3. Agent 获取证据
   ClaudeRuntime -> MCP tools
      -> execute_sql -> trace_processor_shell
      -> invoke_skill -> SkillExecutor -> SQL / DataEnvelope
      -> lookup_knowledge / lookup_sql_schema / fetch_artifact

4. 后端流式输出
   Claude SDK events -> claudeSseBridge -> StreamProjector -> SSE
      -> 客户端渲染 progress, tables, thought, answer tokens

5. 结束与报告
   conclusion -> analysis_completed -> HTML report -> /api/reports/:id
```

## 文档与策略分工

CameraPerf 有两类"内容"：

| 内容 | 位置 | 运行时角色 |
|---|---|---|
| Strategy / Prompt template | `backend/strategies/*.strategy.md`, `*.template.md` | 进入系统 Prompt，约束 agent 思考方式 |
| YAML Skill | `backend/skills/**/*.skill.yaml` | 被 MCP `invoke_skill` 调用，确定性执行 SQL 分析 |
| Rendering pipeline docs | `docs/rendering_pipelines/*.md` | 教学模式和管线结果的知识来源 |
| 普通 docs | `docs/` 其他目录 | 面向用户和贡献者 |

不要在 TypeScript 中硬编码 Prompt 内容。TypeScript 只负责加载、变量替换和结构性编排。
