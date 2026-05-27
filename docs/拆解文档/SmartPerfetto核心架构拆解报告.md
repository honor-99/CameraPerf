# CameraPerf 项目核心架构拆解报告

> 基于源码分析 + 文档，为后续精简重构到「Trace智能拆解工具 + Log分析工具」提供依据。

---

## 一、项目定位

CameraPerf 是基于 Google Perfetto 的 **Android 性能分析平台**，在 Perfetto UI 基础上增加 AI 分析层：用户用自然语言提问，后端通过 Claude Agent SDK 编排 SQL 查询和 YAML 定义的 Skill（预定义分析技能），输出结构化性能诊断结论。

**技术栈：**
- 后端：Express (Node.js >= 24) + TypeScript
- AI 编排：`@anthropic-ai/claude-agent-sdk` v0.2.63
- Trace 引擎：Perfetto `trace_processor_shell` (C++，通过 HTTP RPC/spawn 调用)
- 前端：预构建的 Perfetto UI + AI Assistant 插件
- 测试：Jest + trace 回归测试（6 条标准 trace）
- 许可证：AGPL-3.0

---

## 二、总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器 (Perfetto UI :10000) + AI Assistant 插件             │
│    ├─ trace 加载 / 时间线 / SQL 查询                          │
│    ├─ AI 面板（右侧/底部/浮窗）                                 │
│    └─ SSE 实时接收分析结果                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP / SSE
┌─────────────────────────▼───────────────────────────────────┐
│  后端 Express (:3000)                                        │
│    ├─ agentv3 运行时（Claude Agent SDK 编排）                  │
│    │    ├─ 20 个 MCP 工具（SQL、Skill、知识库、Schema 等）       │
│    │    ├─ 场景策略注入（12 个场景）                             │
│    │    └─ Verifier 验证 + 报告生成                            │
│    ├─ Skill 引擎（YAML 定义的确定性分析流水线）                  │
│    └─ trace_processor_shell（Perfetto 原生 SQL 引擎，RPC 池）  │
└─────────────────────────────────────────────────────────────┘
```

**数据流：**
```
用户提问 → 场景分类（关键词匹配，<1ms）
         → 策略注入（对应场景 .strategy.md）
         → 复杂度判断（keyword rules → hard rules → Haiku 分类器）
         → 选择 fast / full 路径
         → Agent 执行（MCP 工具 + Skill + SQL）
         → Verifier 验证
         → 结论 + 报告
```

---

## 三、核心模块详细拆解

### 3.1 Agent 编排引擎 (agentv3/)

**定位：整个系统的"大脑"**

```
agentv3/
├── claudeConfig.ts          # Claude SDK 配置（API key、模型、超时、预算）
├── types.ts                 # 500 行核心类型定义
├── strategyLoader.ts        # 策略加载器
├── traceCompletenessProber.ts # Trace 数据完整性诊断
├── standaloneMcpServer.ts   # 独立 MCP Server 模式
├── toolCallSummary.ts       # 工具调用摘要
├── sqlSummarizer.ts         # SQL 结果摘要
├── sqlIncludeInjector.ts    # SQL INCLUDE 注入
├── sessionStateSnapshot.ts  # 会话状态快照
└── selfImprove/             # 自我改进管道（14 个文件）
```

**关键能力：**

| 能力 | 实现 | 复杂度 |
|------|------|--------|
| 场景分类 | 关键词匹配 → 12 个场景 | 中 |
| 复杂度路由 | keyword rules → hard rules → Haiku | 高 |
| 分析模式 | fast (10轮/3工具) / full (60轮/20工具) / auto | 高 |
| 计划追踪 | AnalysisPlanV3（阶段+工具调用匹配） | 高 |
| 假设验证 | Hypothesis形成→确认→拒绝 循环 | 高 |
| 不确定性标记 | UncertaintyFlag（中途人工介入） | 中 |
| 结论验证 | Verifier（启发式+LLM双重验证） | 高 |
| 模式记忆 | 正/负面分析模式持久化 | 高 |
| 自我改进 | 策略自动修补、反馈管道、审查队列 | 极高 |
| 多轮对话 | SDK session 恢复、上下文继承 | 中 |

### 3.2 Skill 引擎 (services/skillEngine/)

**定位：确定性的 YAML 定义分析流水线**

代码量约 30 个文件。这是一个**通用 DSL 执行引擎**：

```
Skill 类型:
├── atomic        # 单步 SQL
├── composite     # 组合多个步骤
├── iterator      # 遍历数据源迭代执行
├── parallel      # 并行执行
├── conditional   # 条件分支
├── diagnostic    # 规则驱动的诊断推理
├── ai_decision   # AI 决策
├── ai_summary    # AI 总结
└── pipeline      # 渲染管线教学
```

**Skill 生命周期：**
```
加载 (skillLoader) → 验证 (skillValidator) → 执行 (skillExecutor)
  → 事件采集 (eventCollector) → 答案生成 (answerGenerator)
  → 智能摘要 (smartSummaryGenerator)
```

**结果分层模型：**
```
L1 概览 (overview)   → 顶层指标（FPS、掉帧率）
L2 列表 (list)       → 列表级数据（滑动会话列表）
L3 诊断 (session)    → 会话级详情
L4 深度 (deep)       → 帧级分析/调用栈
```

### 3.3 Skill 资产库 (skills/) — 100+ YAML 定义

```
skills/
├── atomic/                     # 原子技能（70+）
│   ├── cpu_topology_view       # CPU 拓扑
│   ├── webview_v8_analysis     # WebView V8 分析
│   ├── wattson_*               # 功耗归因
│   └── ...（大量原子 SQL 查询）
├── composite/                  # 组合技能（30+）
│   ├── scrolling_analysis      # 滑动分析 ⭐ (3288行 YAML)
│   ├── startup_analysis        # 启动分析
│   ├── anr_analysis            # ANR 分析
│   ├── memory_analysis         # 内存分析
│   ├── cpu_analysis            # CPU 分析
│   ├── binder_analysis         # Binder 分析
│   ├── surfaceflinger_analysis # SF 分析
│   ├── scroll_session_analysis # 滑动区间分析
│   ├── jank_frame_detail       # 卡顿帧详情
│   ├── frame_blocking_calls    # 帧内阻塞调用
│   ├── blocking_chain_analysis # 阻塞链分析
│   └── ...（20+ 复合分析）
├── deep/                       # 深度分析
│   ├── cpu_profiling           # CPU profiling
│   └── callstack_analysis      # 调用栈分析
├── pipelines/                  # 渲染管线（30+）
│   ├── android_view_standard   # 标准 HWUI
│   ├── flutter_*               # Flutter 各模式
│   ├── compose_standard        # Compose
│   ├── webview_*               # WebView 渲染
│   ├── rn_*                    # React Native
│   └── ...（覆盖所有 Android 渲染架构）
├── modules/                    # 模块专家系统
│   ├── framework/  (ams, wms, sf, input, choreographer, art)
│   ├── hardware/   (cpu, gpu, memory, power, thermal)
│   ├── kernel/     (scheduler, binder, lock, filesystem)
│   └── app/        (launcher, systemui, third_party)
├── vendors/                    # 厂商适配（8 家）
│   ├── xiaomi, vivo, samsung, qualcomm
│   ├── pixel, oppo, mtk, honor
│   └── *.override.yaml 覆盖
└── config/                     # 配置模板
```

### 3.4 策略系统 (strategies/)

**定位：场景特定的系统 Prompt，用 Markdown 编写**

```
strategies/
├── *.strategy.md              # 12 个场景策略
│   ├── scrolling.strategy.md  # 滑动分析 ⭐ (438行，极详尽)
│   ├── startup.strategy.md    # 启动分析
│   ├── anr.strategy.md        # ANR 分析
│   ├── pipeline.strategy.md   # 渲染管线
│   ├── memory.strategy.md     # 内存分析
│   ├── interaction.strategy.md # 交互分析
│   ├── game.strategy.md       # 游戏场景
│   ├── overview.strategy.md   # 概览
│   ├── general.strategy.md    # 通用
│   └── ...
├── *.template.md              # 可复用模板（20+）
│   ├── prompt-role.template.md
│   ├── prompt-methodology.template.md
│   ├── prompt-quick.template.md
│   ├── prompt-output-format.template.md
│   ├── arch-*.template.md     # 架构知识
│   ├── knowledge-*.template.md # 领域知识
│   └── selection-*.template.md # 选区上下文
```

**以 scrolling.strategy.md 为例，定义了极详尽的 SOP：**
- Phase 1: 概览+掉帧列表+批量根因分类
- Phase 1.3: 全局上下文检查（视频/插帧/温控/后台干扰）
- Phase 1.5: 架构感知分支（30+种渲染架构的分别处理）
- Phase 1.7: 根因分支深钻（10条分路规则）
- Phase 1.8: 帧内指标补充
- Phase 1.9: 根因深钻（强制执行，包含 WHY 链深度要求）
- Phase 1.95: 缺帧检测
- Phase 2-3: 补充深钻+综合结论

### 3.5 Trace 处理器服务 (traceProcessorService + workingTraceProcessor)

**定位：管理 trace_processor_shell 进程生命周期**

```
核心能力:
├── trace 上传（分块上传，支持大文件）
├── trace_processor_shell 启动/管理
│   ├── 端口池管理 (portPool)
│   ├── stdlib 自动加载（Tier 0 核心模块 + 按需加载）
│   ├── 健康检查 + 自动恢复
│   └── 孤儿进程清理
├── SQL 查询代理（HTTP RPC 模式）
├── 外部 RPC 注册（前端已连接时复用）
└── trace 元数据提取
```

**critical stdlib modules（Tier 0）：**
- `android.frames.timeline` — 帧/卡顿分析基础
- `android.startup.startups` — 启动分析基础
- `android.binder` — IPC 分析基础

### 3.6 MCP 工具体系（20个工具）

Agent 通过 MCP 协议暴露给 Claude 的工具集：

| 工具 | 功能 | 关键程度 |
|------|------|----------|
| `execute_sql` | 执行 PerfettoSQL 查询 | ⭐⭐⭐ |
| `invoke_skill` | 调用 YAML 分析Skill | ⭐⭐⭐ |
| `lookup_sql_schema` | 查询 SQL schema 信息 | ⭐⭐ |
| `lookup_knowledge` | 查询领域知识 | ⭐⭐ |
| `submit_plan` | 提交分析计划 | ⭐⭐ |
| `write_analysis_note` | 写分析笔记 | ⭐ |
| `detect_architecture` | 检测渲染架构 | ⭐⭐ |
| `fetch_artifact` | 获取大型结果分页 | ⭐⭐ |
| + 更多... | | |

### 3.7 辅助服务

| 服务 | 用途 |
|------|------|
| `sqlKnowledgeBase` | 检索 PerfettoSQL 知识，匹配用户查询 |
| `sqlValidator` | SQL 语法验证 |
| `sqlTemplateEngine` | SQL 模板引擎 |
| `reportGenerator` | HTML 报告生成 |
| `sessionPersistenceService` | 会话持久化 |
| `sessionLogger` | 会话日志（JSONL） |
| `resultExportService` | 结果导出 |
| `providerManager` | LLM 提供商管理 |

---

## 四、代码规模估算

| 模块 | 文件数 | 代码量估算 | 复杂度 |
|------|--------|-----------|--------|
| agentv3/ (编排核心) | ~40 | ~15K 行 | 极高 |
| skillEngine/ (Skill引擎) | ~15 | ~8K 行 | 高 |
| services/ (核心服务) | ~50 | ~20K 行 | 高 |
| agent/ (旧版Agent) | ~80 | ~30K 行 | 中-高 |
| skills/ (YAML资产) | ~150 | ~500K 行(主要是SQL) | 极高 |
| strategies/ (策略模板) | ~40 | ~100K 行 | 极高 |
| routes/ (API路由) | ~20 | ~5K 行 | 低 |
| types/ (类型定义) | ~10 | ~3K 行 | 低 |
| utils/ (工具函数) | ~15 | ~3K 行 | 低 |
| **总计** | **~450** | **~680K 行** | |

---

## 五、可剥离 vs 必须保留 — 面向「Trace智能拆解工具 + Log分析工具」

### 5.1 必须保留的核心（直接可用）

| 模块 | 保留原因 | 适配新场景 |
|------|---------|-----------|
| **Skill 引擎框架** | 通用 DSL 执行引擎，与业务无关 | 直接用 |
| **Skill 类型系统** | atomic/composite/iterator/diagnostic 等可复用于任意场景 | 直接用 |
| **trace_processor_shell 通信** | Perfetto SQL 引擎，trace 分析的基础 | 直接用 |
| **MCP 工具框架** | Agent 工具注册模式可复用 | 简化为少量核心工具 |
| **场景分类器** | 意图识别，可复用于 log 分析 | 改匹配规则 |
| **SSE 流式输出** | 实时推送分析结果 | 直接用 |
| **DataEnvelope 数据契约** | 前后端统一数据格式 | 直接用 |

### 5.2 应该剥离的（Android 性能分析特有内容）

| 内容 | 原因 |
|------|------|
| skills/ 中 150+ YAML | 全部是 Android Perfetto 专用，需重写 |
| strategies/ 中 40+ 模板 | Android 场景专用知识 |
| pipelines/ 渲染管线分析 | Android 渲染架构专有 |
| vendors/ 厂商适配 | Android OEM 专用 |
| agent/ 旧版运行时 (agentv2) | 已被 agentv3 取代 |
| selfImprove/ 自我改进 | 过度工程，初期不需要 |
| reportGenerator | HTML 报告生成，可简化为 markdown |
| providerManager | 多模型管理，初期单模型即可 |
| sessionPersistenceService | 会话持久化，可简化 |
| adbTools / traceConfigGenerator | Android 抓 trace 工具 |
| flamegraph-analyzer (Rust) | 火焰图分析，独立模块 |
| sceneReconstruction | trace 场景重建 |

### 5.3 需要重新实现的（适配 log 分析）

| 需求 | 说明 |
|------|------|
| **Log 解析器** | 支持常见 log 格式（logcat、syslog、自定义格式） |
| **Log Skill 资产库** | 针对 log 场景重写 YAML Skill |
| **Log 知识库** | log 模式识别、错误码解释等 |
| **Log 索引/搜索** | 基于时间线 + 关键词的高性能搜索 |

---

## 六、「Trace智能拆解工具」最小可行架构

```
┌─────────────────────────────────────────────────────────────┐
│  用户界面（CLI / Web UI）                                     │
│    ├─ 上传 trace 文件                                        │
│    ├─ 提问/选择分析模板                                       │
│    └─ 查看结构化的分析结果                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  后端核心（精简后的 Express 服务）                              │
│    ├─ Agent 运行时（单一 LLM 模型）                            │
│    │    ├─ 精简 MCP 工具（5-8个）                              │
│    │    │    ├─ execute_sql     → 执行 PerfettoSQL         │
│    │    │    ├─ invoke_skill    → 调用分析 Skill            │
│    │    │    ├─ lookup_schema   → 查询数据 schema           │
│    │    │    ├─ lookup_knowledge → 查询知识库               │
│    │    │    └─ fetch_artifact  → 分页获取大结果             │
│    │    └─ 场景分类（精简到 3-5 类）                           │
│    ├─ Skill 引擎（复用现有实现）                                │
│    │    └─ 新 Skill 资产库（为 trace 通用分析重写）              │
│    └─ trace_processor_shell 管理（复用现有 WorkingTraceProcessor）│
└─────────────────────────────────────────────────────────────┘
```

**保留的 MCP 工具（精简约 5 个）：**

| 工具 | 原项目 | 新项目 | 说明 |
|------|--------|--------|------|
| `execute_sql` | ✅ | ✅ | 执行 PerfettoSQL |
| `invoke_skill` | ✅ | ✅ | 调用 YAML Skill |
| `lookup_schema` | ✅ | ✅ | 查询 SQL schema |
| `lookup_knowledge` | ✅ | ✅ | 查领域知识 |
| `fetch_artifact` | ✅ | ✅ | 结果分页 |
| `submit_plan` | ✅ | ❌ 可砍 | 过度 |
| `write_analysis_note` | ✅ | ❌ 可砍 | 可用 conversation 替代 |
| `detect_architecture` | ✅ | ❌ 可砍 | Android 专用 |

---

## 七、「Log分析工具」最小可行架构

```
┌─────────────────────────────────────────────────────────────┐
│  用户界面（CLI / Web UI）                                     │
│    ├─ 上传/拖入 log 文件                                      │
│    ├─ 自然语言分析提问                                         │
│    └─ 查看时间线 + AI 分析结果                                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  后端核心                                                     │
│    ├─ Log 解析层                                              │
│    │    ├─ 格式检测（logcat / syslog / JSON / 自定义）         │
│    │    ├─ 解析为结构化数据（时间戳 + 级别 + tag + 消息）        │
│    │    └─ 导入 SQLite（复用 trace_processor 的 SQL 查询能力）  │
│    ├─ Agent 运行时（同 Trace 工具）                            │
│    │    ├─ MCP 工具                                           │
│    │    │    ├─ execute_log_query  → 查询 log 数据库          │
│    │    │    ├─ invoke_skill      → Log 分析 Skill           │
│    │    │    ├─ search_logs       → 关键词/正则搜索           │
│    │    │    └─ timeline_context  → 某时间点前后上下文         │
│    │    └─ 场景分类（crash/anr/性能异常/行为异常）               │
│    ├─ Skill 引擎（复用）                                       │
│    │    └─ Log Skill 资产库                                   │
│    │        ├─ crash_analysis      → 崩溃堆栈分析             │
│    │        ├─ anr_trace_analysis  → ANR trace 解读           │
│    │        ├─ error_pattern       → 错误模式聚合             │
│    │        ├─ timeline_overview   → 时间线概览               │
│    │        └─ process_lifecycle   → 进程生命周期追踪         │
│    └─ Vector DB / 全文索引（log 搜索用）                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、技术取舍建议

### 可以砍掉的（降低复杂度）

| 特性 | 原因 | 节省工作量 |
|------|------|-----------|
| agentv2 (DeepSeek 降级路径) | 已被 agentv3 取代 | ~30K 行 |
| selfImprove/ 自我改进管道 | 过度工程，初期不需要 | ~8K 行 |
| 多模型/Provider 切换 | 初期单一模型足够 | ~3K 行 |
| 场景重建 (Scene Reconstruction) | 复杂且 Android 专用 | ~5K 行 |
| HTML 报告生成 | 可简化为 Markdown | ~2K 行 |
| CI Gate | 初期不需要 | ~2K 行 |
| RAG Admin | 过度 | ~1K 行 |
| AdbTools / TraceRecorder | Android 专用 | ~5K 行 |
| Flamegraph Analyzer (Rust) | 可独立为可选模块 | ~3K 行 |
| 多轮对话 + Session 持久化 | 初期单轮即可 | ~5K 行 |

### 核心保留清单

```
保留模块:
├── agentv3/
│   ├── claudeConfig.ts        # LLM 配置
│   ├── types.ts               # 核心类型（需精简）
│   ├── strategyLoader.ts      # 策略加载
│   └── standaloneMcpServer.ts # MCP 服务
├── services/
│   ├── skillEngine/           # ⭐ 完整保留
│   ├── workingTraceProcessor.ts # ⭐ 完整保留
│   ├── traceProcessorService.ts # ⭐ 完整保留
│   └── traceProcessorProtobuf.ts # 完整保留
├── skills/                    # 框架保留，内容重写
├── strategies/                # 框架保留，内容重写
├── types/
│   ├── dataContract.ts        # DataEnvelope 保留
│   └── index.ts               # 精简
└── routes/
    └── agentRoutes.ts         # 核心路由
```

---

## 九、推荐的开发路径

```
Phase 1: 剥离 → 核心骨架运行
├── 删除 agentv2、selfImprove、sceneReconstruction 等
├── 保留 Skill 引擎 + trace_processor_shell + agentv3 最小骨架
├── 简化 MCP 工具到 5 个核心工具
└── 目标：最小可运行版本，能执行 SQL + 调用 Skill

Phase 2: Trace 智能拆解工具
├── 为新场景重写 Skill 资产库（10-20 个核心 Skill）
├── 重写策略模板（3-5 个通用场景）
├── 简化 UI（CLI first，Web 可选）
└── 目标：上传 trace → 自然语言分析 → 结构化结果

Phase 3: Log 分析工具
├── 实现 Log 解析器（多格式）
├── Log → SQLite 导入
├── Log Skill 资产库
├── Log 搜索/索引
└── 目标：上传 log → 智能分析和模式识别
```

---

## 十、关键风险和注意事项

1. **Skill YAML DSL** — 最大的资产也是最大的依赖。重写 Skill 资产库工作量巨大（现有 150+ 个 Skill，50万+ 行）
2. **Perfetto 依赖** — `trace_processor_shell` 是 C++ 原生程序，需要预编译，限制了跨平台部署
3. **Claude Agent SDK 绑定** — 与 Anthropic 生态深度绑定，切换 LLM 成本高
4. **策略 Prompt 高度 Android 专用** — 需要针对新领域重写，不能直接复用
5. **AGPL-3.0 许可证** — 二次开发需注意合规

---

> **报告生成时间：** 2026-05-27
> **代码基础：** CameraPerf (Gracker/CameraPerf)
> **分析范围：** backend/src + skills + strategies + docs
