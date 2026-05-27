# CameraPerf — 专注 Camera 预览/录像性能的精简方案

> 从 SmartPerfetto（通用 Android 性能分析）收缩到 CameraPerf（Camera 预览+录像性能）
> 原则：只保留与 Camera 场景直接相关的资产，其他全部砍掉

---

## 一、Camera 性能分析的核心问题域

Camera 场景与普通 UI 场景有本质区别，需要保留的分析能力也不同：

### 1.1 Camera 特有的性能模式

| 问题 | 分析维度 | 涉及的 Perfetto 数据源 |
|------|---------|----------------------|
| **预览卡顿** | SF 消费帧率、BufferQueue 状态 | actual_frame_timeline_slice, VSYNC-sf, SurfaceFlinger |
| **多路输出背压** | preview/video/analysis 三路互相影响 | Camera HAL→BufferQueue→各 consumer |
| **录像丢帧** | 编码器压力、media.codec 状态 | codec slices, CPU scheduling |
| **Sensor 采集节奏不对齐** | capture frame rate ≠ display frame rate | Camera HAL processCaptureResult 频率 vs SF latch 频率 |
| **Release Fence 晚回** | HWC/SF/Codec 消费侧阻塞 HAL | fence timeline, buffer release timing |
| **TextureView 模式额外开销** | updateTexImage + GPU 重采样 | RenderThread slices |
| **发热降频** | 录像+预览持续负载 → thermal throttling | CPU frequency, thermal zones |
| **内存压力** | Camera buffer + codec buffer + app buffer | dma-buf, GPU memory |
| **相机启动慢** | openCamera → createCaptureSession → 首帧 | Camera HAL slices, startup timeline |
| **模式切换卡顿** | 预览↔录像切换、Camera1↔Camera2 | session reconfiguration timeline |

### 1.2 Camera vs 通用 UI — 分析需求对比

| 分析维度 | 通用 Android UI | Camera | CameraPerf 需要？ |
|---------|----------------|--------|-------------------|
| FrameTimeline 帧分析 | ✅ 滑动/启动/ANR | ✅ 预览帧消费 | ✅ 保留，但聚焦 SF consumer |
| 渲染管线检测 | ✅ 30+ 种管线 | ✅ SurfaceView/TextureView | ✅ 只保留 2 种 |
| CPU 调度分析 | ✅ | ✅ HAL/encoder 线程 | ✅ 保留 |
| GPU 分析 | ✅ 部分场景 | ✅ 预览渲染+编码 | ✅ 保留 |
| Binder IPC | ✅ 系统调用 | ✅ Camera HAL Binder | ✅ 保留 |
| 内存分析 | ✅ | ✅ dma-buf/ION/GraphicBuffer | ✅ 保留（聚焦 buffer 内存） |
| 热管理 | ✅ 部分场景 | ✅ 录像发热核心问题 | ✅ 保留（优先级提升） |
| 功耗分析 | ✅ 部分场景 | ✅ 相机是功耗大户 | ✅ 保留 |
| SurfaceFlinger | ✅ | ✅ 预览 Surface 合成 | ✅ 保留 |
| Fence 时序 | ⚠️ 次要 | ✅ 关键（BufferQueue 生命周期） | ✅ 新增为核心 |
| VSync 对齐 | ✅ | ✅ Sensor 节奏 vs SF 节奏 | ✅ 保留 |
| 锁竞争 | ⚠️ 次要 | ⚠️ 通用 | ✅ 保留 |
| **滑动分析** | ⭐ | ❌ 无关 | ❌ 砍掉 |
| **启动分析** | ⭐ | ❌ 无关（相机启动 ≠ App 启动） | ❌ 砍掉 |
| **ANR 分析** | ⭐ | ❌ 无关 | ❌ 砍掉 |
| **点击响应** | ⭐ | ❌ 无关 | ❌ 砍掉 |
| **交互分析** | ⭐ | ❌ 无关 | ❌ 砍掉 |
| **游戏引擎** | ⭐ | ❌ 无关 | ❌ 砍掉 |
| **Flutter/Compose/RN/WebView** | ⭐ | ❌ 无关 | ❌ 砍掉 |
| **输入事件延迟** | ⭐ | ❌ 无关 | ❌ 砍掉 |
| **导航分析** | ⭐ | ❌ 无关 | ❌ 砍掉 |

---

## 二、CameraPerf 最终保留清单

### 2.1 Skill 资产 — 从 150+ → ~25

#### ✅ 保留（Camera 核心分析）

```
Camera 特有:
├── camera_pipeline                # 相机管线定义（已有）
├── camera_preview_jank            # 【新增】预览卡顿综合分析
├── camera_recording_analysis      # 【新增】录像性能分析
├── camera_multi_output_backpressure # 【新增】多路输出背压分析
├── camera_thermal_recording       # 【新增】录像发热分析
├── sf_frame_consumption           # SF 消费端帧率（已有）
├── present_fence_timing           # Fence 时序（已有）
├── fence_wait_decomposition       # Fence 等待分解（已有）
├── vsync_alignment_in_range       # VSync 对齐（已有）
├── vsync_period_detection          # VSync 周期（已有）
├── vsync_config                    # VSync 配置（已有）
├── textureview_producer_frame_timing # TextureView 模式（已有）

通用但 Camera 高优先级:
├── cpu_analysis                   # CPU 分析（已有）
├── cpu_topology_view              # CPU 拓扑（已有）
├── gpu_analysis                   # GPU 分析（已有）
├── thermal_throttling             # 温控降频（已有）
├── thermal_throttling_chain       # 温控链（已有）
├── binder_analysis                # Binder 分析（已有）
├── memory_analysis                # 内存分析（已有）
├── surfaceflinger_analysis        # SF 合成（已有）
├── power_consumption_overview     # 功耗概览（已有）
├── lock_contention_analysis       # 锁竞争（已有）
├── io_pressure                    # IO 压力（已有）
├── frame_blocking_calls           # 帧内阻塞（已有）
├── blocking_chain_analysis        # 阻塞链（已有）
├── cpu_profiling                  # CPU profiling（已有）
├── gc_analysis                    # GC 分析（已有）

支持性质的原子 Skill:
├── cpu_thread_utilization_period  # 线程 CPU 利用率
├── cpu_process_utilization_period # 进程 CPU 利用率
├── cpu_cluster_mapping_view       # CPU cluster 映射
├── android_gpu_work_period_track  # GPU work period
├── mali_gpu_power_state           # Mali GPU 状态
├── battery_drain_attribution      # 耗电归因
├── dmabuf_analysis                # DMA-BUF 分析
```

#### ❌ 砍掉（与 Camera 无关）

```
砍掉的原因分类:

UI 滑动/帧相关 (~40 skills):
├── scrolling_analysis            # 滑动分析（3K+ 行 YAML）
├── scroll_session_analysis
├── jank_frame_detail
├── flutter_scrolling_analysis
├── consumer_jank_detection
├── frame_production_gap
├── frame_overrun_summary
├── cpu_time_per_frame
├── frame_ui_time_breakdown
├── compose_recomposition_hotspot
└── ... (30+ 个)

应用生命周期相关 (~15 skills):
├── startup_analysis               # 启动分析（1K+ 行 YAML）
├── startup_detail
├── anr_analysis                   # ANR 分析（885 行 YAML）
├── anr_detail
├── lmk_analysis
├── suspend_wakeup_analysis
└── ... (10+ 个)

渲染管线检测 (~28 skills):
├── 所有 pipelines/ 下非 camera 的 YAML
├── android_view_standard_blast
├── android_view_software
├── flutter_textureview
├── flutter_surfaceview_skia
├── flutter_surfaceview_impeller
├── compose_standard
├── rn_new_arch / rn_old_arch / rn_skia
├── webview_gl_functor / webview_surface_control / webview_surfaceview_wrapper / webview_textureview_custom
├── chrome_browser_viz
├── game_engine
├── video_overlay_hwc
├── imagereader_pipeline
└── ... 

厂商启动适配:
├── vendors/ 下全部 8 个 startup.override.yaml

UI 交互相关:
├── click_response_analysis
├── click_response_detail
├── navigation_analysis
├── touch-tracking (策略)
├── scroll-response (策略)
├── interaction (策略)

网络/媒体:
├── network_analysis
├── media (策略)
```

### 2.2 策略模板 — 从 15 → 3

```
✅ 保留:
├── camera.strategy.md             # 【重写】Camera 场景 SOP
├── pipeline.strategy.md           # 渲染管线策略（精简到只覆盖 Camera 管线）
└── general.strategy.md            # 通用回退策略

❌ 砍掉:
├── scrolling.strategy.md          # 滑动 SOP（438 行）
├── startup.strategy.md            # 启动 SOP
├── anr.strategy.md                # ANR SOP
├── memory.strategy.md             # 内存 SOP
├── interaction.strategy.md        # 交互 SOP
├── game.strategy.md               # 游戏 SOP
├── overview.strategy.md           # 概览 SOP
├── scroll-response.strategy.md    # 滚动响应
├── touch-tracking.strategy.md     # 触摸追踪
├── network.strategy.md            # 网络
├── power.strategy.md              # 功耗
├── media.strategy.md              # 媒体
├── linux.strategy.md              # Linux
├── runtime-correctness.strategy.md # 运行时
├── teaching.strategy.md           # 教学
└── + 大量 knowledge-*.template.md  # 只保留 camera 相关的知识模板
```

### 2.3 平台代码

同上一轮决策，继续砍掉：

```
❌ 删除:
├── agentv2/              (~30K)
├── selfImprove/          (~8K)
├── 多 Provider 切换      (~3K)
├── sceneReconstruction   (~5K)
├── teaching              (~3K)
├── ciGate                (~2K)
├── ragAdmin              (~1K)
├── adbTools               (~3K)
├── flamegraph (Rust)      (~3K)
├── traceRecorder          (~2K)
├── legacyAgentApi         (~2K)
├── chartRoutes            (~1K)
├── caseRoutes             (~1K)
```

### 2.4 MCP 工具 — 从 20 → 8

```
✅ 保留:
├── execute_sql            # 执行 PerfettoSQL
├── invoke_skill           # 调用 YAML Skill
├── lookup_schema          # 查 SQL Schema
├── lookup_knowledge       # 查领域知识
├── fetch_artifact         # 大结果分页
├── submit_plan            # 分析计划
├── detect_architecture    # 检测 Camera 管线（SurfaceView/TextureView）
└── write_note             # 跨轮笔记（简化为单轮可选项）

❌ 砍掉:
├── log_session
├── adb_tools
├── generate_chart
├── export_report（简化为 Markdown 输出）
├── manage_case
├── query_rag
├── + 新增的工具先不做（Log 侧 Phase 3 再加）
```

---

## 三、最终代码规模

| 层次 | SmartPerfetto | 通用精简版 | CameraPerf | 相比原始 |
|------|:---:|:---:|:---:|:---:|
| agent 编排核心 | ~80K | ~20K | ~15K | **-81%** |
| Skill 引擎 | ~8K | ~8K | ~8K | 0 |
| Skill 资产 | ~500K | ~500K | ~80K | **-84%** |
| 策略模板 | ~100K | ~100K | ~15K | **-85%** |
| 核心服务 | ~25K | ~15K | ~12K | **-52%** |
| API 路由 | ~5K | ~2K | ~1.5K | **-70%** |
| **总计** | **~720K** | **~645K** | **~132K** | **-82%** |

> 从 720K → 132K，减少了 **82%** 的代码量。这才是真正的精简——砍掉领域不相关的资产。

---

## 四、最小可行架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户入口                                   │
│   CLI 命令行 / 轻量 Web UI                                   │
│                                                             │
│   输入：Camera trace 文件                                     │
│   问题：预览卡顿 / 录像丢帧 / 发热 / 启动慢 / 模式切换慢         │
│   输出：结构化诊断报告 (Markdown)                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    CameraPerf 分析引擎                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Agent 运行时 (Claude Agent SDK)                      │   │
│  │                                                       │   │
│  │  场景分类（3类）→ 策略注入 → 计划执行 → 结论            │   │
│  │                                                       │   │
│  │  MCP 工具 (8个)：                                      │   │
│  │  execute_sql · invoke_skill · lookup_schema           │   │
│  │  lookup_knowledge · fetch_artifact                    │   │
│  │  submit_plan · detect_architecture · write_note       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │  Skill 引擎        │  │  trace_processor_shell          │  │
│  │  (完整保留)        │  │  (完整保留)                     │  │
│  └──────┬───────────┘  └──────────────┬─────────────────┘  │
│         │                             │                      │
│  ┌──────▼─────────────────────────────▼─────────────────┐   │
│  │  CameraPerf Skill 资产库 (~25 个)                      │   │
│  │                                                       │   │
│  │  Camera 专用复合 Skill (4个)                            │   │
│  │  ├─ camera_preview_jank          预览卡顿诊断          │   │
│  │  ├─ camera_recording_analysis    录像丢帧诊断          │   │
│  │  ├─ camera_multi_output_bp       多路背压诊断          │   │
│  │  └─ camera_thermal_recording     录像发热诊断          │   │
│  │                                                       │   │
│  │  帧/管线 Skill (6个)                                   │   │
│  │  ├─ sf_frame_consumption         SF 消费帧率          │   │
│  │  ├─ present_fence_timing         Fence 时序           │   │
│  │  ├─ fence_wait_decomposition     Fence 等待分解       │   │
│  │  ├─ vsync_alignment_in_range     VSync 对齐           │   │
│  │  ├─ vsync_period_detection       VSync 周期           │   │
│  │  └─ textureview_producer_timing  TextureView 模式     │   │
│  │                                                       │   │
│  │  通用分析 Skill (15个，Camera 高优先级)                  │   │
│  │  ├─ cpu_analysis + cpu_topology + cpu_profiling       │   │
│  │  ├─ gpu_analysis + android_gpu_work_period_track     │   │
│  │  ├─ thermal_throttling + thermal_throttling_chain    │   │
│  │  ├─ binder_analysis                                  │   │
│  │  ├─ memory_analysis + dmabuf_analysis                │   │
│  │  ├─ surfaceflinger_analysis                          │   │
│  │  ├─ power_consumption_overview + battery_drain       │   │
│  │  ├─ lock_contention_analysis                         │   │
│  │  ├─ frame_blocking_calls + blocking_chain_analysis   │   │
│  │  ├─ io_pressure                                       │   │
│  │  └─ gc_analysis                                       │   │
│  │                                                       │   │
│  │  策略模板 (3个)                                        │   │
│  │  ├─ camera.strategy.md            Camera 分析 SOP     │   │
│  │  ├─ pipeline.strategy.md          管线知识             │   │
│  │  └─ general.strategy.md           通用回退             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 五、CameraPerf 核心分析流程

```
用户上传 Camera trace + 提问:
  "预览卡顿" / "录像2分钟后掉帧" / "发热严重" / "启动慢"

        ↓

场景分类（3类）:
  ├─ camera_preview      → camera.strategy.md 预览路径
  ├─ camera_recording    → camera.strategy.md 录像路径
  └─ camera_general      → general.strategy.md

        ↓

Agent 执行 SOP:

Phase 1 — 环境检测:
  ├─ vsync_period_detection    → 确定显示刷新率
  ├─ detect_architecture       → SurfaceView / TextureView?
  └─ camera_pipeline           → 识别预览+录像+分析三路流

Phase 2 — 核心指标:
  ├─ sf_frame_consumption      → SF 消费端帧率（是否是 Camera 帧？）
  ├─ present_fence_timing      → Fence 时序（谁阻塞了 buffer 释放？）
  ├─ vsync_alignment_in_range  → Sensor 节奏 vs 显示节奏

Phase 3 — 根因深钻（按需）:
  ├─ camera_multi_output_bp    → 三路输出谁在回压？
  ├─ textureview_producer_timing → 是否 TextureView 额外开销？
  ├─ cpu_analysis              → Camera HAL 线程有没有被挤占？
  ├─ thermal_throttling        → 是否降频导致丢帧？
  ├─ gpu_analysis              → GPU 是否饱和？
  ├─ memory_analysis           → dma-buf 是否不足？
  ├─ binder_analysis           → Camera HAL Binder 延迟？
  └─ frame_blocking_calls      → 帧内阻塞（锁/IO/Binder）

Phase 4 — 综合诊断:
  ├─ 问题根因 + 证据
  ├─ 优先级排序的优化建议
  └─ Markdown 报告
```

---

## 六、与通用精简版的对比

| 维度 | 通用精简版 | CameraPerf | 优势 |
|------|-----------|------------|------|
| Skills | 150+ | ~25 | 分析聚焦，Agent 不会走错路 |
| Strategies | 15 | 3 | 场景匹配更精准 |
| 可砍的代码 | ~70K (平台) | ~580K (平台+领域) | 真正的精简 |
| Skill 资产维护 | 维护 150 个 | 维护 25 个 | 大幅降低维护成本 |
| 分析准确性 | Agent 可能在无关 Skill 间迷路 | Agent 只在 Camera 领域内决策 | 更高的分析质量 |
| 新增 Log 分析 | ✅ | ✅ Phase 3 | 架构不变 |

---

## 七、实施路径

```
Phase 0: 大规模剥离（1周）
├── 删除 125 个无关 Skill（保留 camera 相关的 25 个）
├── 删除 12 个无关策略
├── 删除 agentv2/selfImprove/多Provider 等平台包袱
├── 重命名策略: scrolling/startup/anr → camera
├── 确保编译通过 + 现有 camera 相关 Skill 可运行
└── 目标: ~132K 行可编译代码

Phase 1: Camera 核心 Skill 开发（2-3周）
├── 新增 camera_preview_jank (复合 Skill)
├── 新增 camera_recording_analysis
├── 新增 camera_multi_output_backpressure
├── 新增 camera_thermal_recording
├── 重写 camera.strategy.md (基于 camera_pipeline 的分析 SOP)
├── 端到端测试: 上传 Camera trace → 自然语言分析 → 诊断报告
└── 目标: 4 个 Camera 场景可用

Phase 2: Log 分析集成（3-4周）
├── Log 解析层（logcat/bugreport/tombstone）
├── Log MCP 工具（6个）
├── Camera-specific Log Skills
│   ├── camera_hal_log_analysis     HAL 层日志分析
│   ├── camera_error_pattern        错误模式聚类
│   ├── camera_session_lifecycle    会话生命周期
│   └── camera_memory_leak_signal   Buffer 泄漏信号
├── Log + Trace 联动分析
└── 目标: trace + log 联合诊断

Phase 3: 优化和完善（持续）
├── 轻量 Web UI（上传+提问+看结果）
├── 多 Camera trace 对比
├── 性能基线建立
└── 持续积累 Camera 分析经验
```

---

## 八、关键决策

### 🔑 决策 1: 为什么要从 Camera 切入？

1. **SmartPerfetto 已有 camera_pipeline 定义**——不是从零开始
2. **Camera 问题域明确可枚举**——预览卡顿、录像丢帧、发热、启动慢、切换慢，5 类
3. **Camera trace 数据源清晰**——FrameTimeline + Fence + BufferQueue + CPU/GPU/thermal
4. **市场缺口**——没有针对 Camera 性能的专用 AI 分析工具

### 🔑 决策 2: 砍掉的边界怎么定？

**判断标准只有一个：这个 Skill/策略是否可能被 Camera 分析用到？**

- `cpu_analysis` → Camera HAL 线程调度 → ✅ 保留
- `scrolling_analysis` → 滑动列表 → ❌ 砍掉
- `startup_analysis` → App 启动，Camera 启动是不同的 → ❌ 砍掉
- `binder_analysis` → Camera HAL 通过 Binder 通信 → ✅ 保留
- `compose_recomposition_hotspot` → Compose 重组 → ❌ 砍掉

### 🔑 决策 3: 要不要保留 Log 分析？

**Phase 3 再加。** 先让 Trace 分析工具 work，因为它是 SmartPerfetto 最成熟的资产。Log 分析是新增模块，可以独立开发。

---

> 版本: CameraPerf v0.1
> 基础: SmartPerfetto → 通用精简版 → CameraPerf
> 目标: 132K 行代码，25 个 Skills，3 个策略，专注 Camera 性能诊断
